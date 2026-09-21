package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.flowpilot.dto.RiskSeverity;
import com.flowpilot.dto.RiskSignalResponse;
import com.flowpilot.dto.RiskSignalType;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.entity.WorkItemPriority;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Deterministic risk detection (vision 7.6). Pure: work items, columns and
 * sprints go in, signals come out; "today" and staleness come from a fixed
 * {@link Clock} so every boundary is exact.
 */
class ProjectRiskDetectorTest {

    private static final long PROJECT = 10L;
    private static final Instant NOW = Instant.parse("2026-09-20T12:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 20);
    private static final long TODO_COL = 1L;
    private static final long DONE_COL = 2L;

    private final ProjectRiskDetector detector = new ProjectRiskDetector(Clock.fixed(NOW, ZoneOffset.UTC));

    private final List<BoardColumn> columns = List.of(column(TODO_COL, "Por hacer"), column(DONE_COL, "Terminado"));

    // ---- helpers ----

    private static BoardColumn column(long id, String name) {
        BoardColumn c = new BoardColumn(PROJECT, name, (int) id * 1024);
        set(c, "id", id);
        return c;
    }

    private static <T> T set(T target, String field, Object value) {
        try {
            var f = target.getClass().getDeclaredField(field);
            f.setAccessible(true);
            f.set(target, value);
            return target;
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
    }

    private static WorkItem item(long id, long columnId, Long assignee, WorkItemPriority priority, Long sprintId) {
        WorkItem w = new WorkItem(PROJECT, columnId, "Tarea " + id, null, assignee, 1, sprintId, priority);
        set(w, "id", id);
        set(w, "updatedAt", OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC)); // fresh by default
        return w;
    }

    private static WorkItem open(long id) {
        return item(id, TODO_COL, 99L, WorkItemPriority.MEDIUM, null);
    }

    private static WorkItem child(long id, long parentId, long columnId) {
        WorkItem w = item(id, columnId, 99L, WorkItemPriority.MEDIUM, null);
        w.setParentWorkItemId(parentId);
        return w;
    }

    private static Sprint activeSprint(long id, LocalDate end) {
        Sprint s = new Sprint(PROJECT, "Sprint " + id, "meta", TODAY.minusDays(10), end);
        set(s, "id", id);
        s.start();
        return s;
    }

    private List<RiskSignalResponse> detect(List<WorkItem> items, List<Sprint> sprints) {
        return detector.detect(items, columns, sprints, Map.of());
    }

    private static List<RiskSignalResponse> ofType(List<RiskSignalResponse> all, RiskSignalType type) {
        return all.stream().filter(s -> s.type() == type).toList();
    }

    // ---- no signals ----

    @Test
    void healthyProjectYieldsNoSignals() {
        assertThat(detect(List.of(open(1), open(2)), List.of())).isEmpty();
    }

    // ---- LARGE_STORY ----

    @Test
    void parentWithFourChildrenIsNotALargeStory() {
        List<WorkItem> items = new ArrayList<>(List.of(open(1)));
        for (long i = 0; i < 4; i++) items.add(child(100 + i, 1, TODO_COL));
        assertThat(ofType(detect(items, List.of()), RiskSignalType.LARGE_STORY)).isEmpty();
    }

    @Test
    void parentWithFiveChildrenIsAMediumLargeStory() {
        List<WorkItem> items = new ArrayList<>(List.of(open(1)));
        for (long i = 0; i < 5; i++) items.add(child(100 + i, 1, TODO_COL));

        List<RiskSignalResponse> signals = ofType(detect(items, List.of()), RiskSignalType.LARGE_STORY);

        assertThat(signals).hasSize(1);
        assertThat(signals.get(0).severity()).isEqualTo(RiskSeverity.MEDIUM);
        assertThat(signals.get(0).workItemId()).isEqualTo(1L);
        assertThat(signals.get(0).userId()).isNull();
        assertThat(signals.get(0).title()).contains("Tarea 1");
        assertThat(signals.get(0).detail()).contains("5");
    }

    @Test
    void parentWithSevenChildrenStaysMediumAndEightIsHigh() {
        List<WorkItem> seven = new ArrayList<>(List.of(open(1)));
        for (long i = 0; i < 7; i++) seven.add(child(100 + i, 1, TODO_COL));
        assertThat(ofType(detect(seven, List.of()), RiskSignalType.LARGE_STORY).get(0).severity())
                .isEqualTo(RiskSeverity.MEDIUM);

        List<WorkItem> eight = new ArrayList<>(List.of(open(1)));
        for (long i = 0; i < 8; i++) eight.add(child(100 + i, 1, TODO_COL));
        assertThat(ofType(detect(eight, List.of()), RiskSignalType.LARGE_STORY).get(0).severity())
                .isEqualTo(RiskSeverity.HIGH);
    }

    // ---- OVERLOADED_MEMBER ----

    private static List<WorkItem> assignedOpen(long userId, int count, long firstId) {
        List<WorkItem> items = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            items.add(item(firstId + i, TODO_COL, userId, WorkItemPriority.MEDIUM, null));
        }
        return items;
    }

    @Test
    void sevenOpenItemsIsNotOverloaded() {
        assertThat(ofType(detect(assignedOpen(5L, 7, 1), List.of()), RiskSignalType.OVERLOADED_MEMBER)).isEmpty();
    }

    @Test
    void eightOpenItemsIsAMediumOverloadWithTheUserId() {
        List<RiskSignalResponse> signals = ofType(
                detector.detect(assignedOpen(5L, 8, 1), columns, List.of(), Map.of(5L, "Ana")),
                RiskSignalType.OVERLOADED_MEMBER);

        assertThat(signals).hasSize(1);
        assertThat(signals.get(0).severity()).isEqualTo(RiskSeverity.MEDIUM);
        assertThat(signals.get(0).userId()).isEqualTo(5L);
        assertThat(signals.get(0).workItemId()).isNull();
        assertThat(signals.get(0).title()).contains("Ana");
    }

    @Test
    void twelveOpenItemsIsHighAndElevenIsMedium() {
        assertThat(ofType(detect(assignedOpen(5L, 11, 1), List.of()), RiskSignalType.OVERLOADED_MEMBER)
                        .get(0)
                        .severity())
                .isEqualTo(RiskSeverity.MEDIUM);
        assertThat(ofType(detect(assignedOpen(5L, 12, 1), List.of()), RiskSignalType.OVERLOADED_MEMBER)
                        .get(0)
                        .severity())
                .isEqualTo(RiskSeverity.HIGH);
    }

    @Test
    void doneItemsDoNotCountTowardsAMembersLoad() {
        List<WorkItem> items = assignedOpen(5L, 7, 1);
        items.add(item(50, DONE_COL, 5L, WorkItemPriority.MEDIUM, null));
        items.add(item(51, DONE_COL, 5L, WorkItemPriority.MEDIUM, null));
        assertThat(ofType(detect(items, List.of()), RiskSignalType.OVERLOADED_MEMBER)).isEmpty();
    }

    @Test
    void unknownUserNameFallsBackToTheId() {
        List<RiskSignalResponse> signals =
                ofType(detect(assignedOpen(5L, 8, 1), List.of()), RiskSignalType.OVERLOADED_MEMBER);
        assertThat(signals.get(0).title()).contains("#5");
    }

    // ---- SPRINT_OVERDUE / SPRINT_AT_RISK ----

    @Test
    void activeSprintEndedYesterdayIsHighOverdue() {
        List<RiskSignalResponse> signals = detect(List.of(open(1)), List.of(activeSprint(7, TODAY.minusDays(1))));

        List<RiskSignalResponse> overdue = ofType(signals, RiskSignalType.SPRINT_OVERDUE);
        assertThat(overdue).hasSize(1);
        assertThat(overdue.get(0).severity()).isEqualTo(RiskSeverity.HIGH);
        assertThat(overdue.get(0).workItemId()).isNull();
        assertThat(ofType(signals, RiskSignalType.SPRINT_AT_RISK)).isEmpty();
    }

    @Test
    void activeSprintEndingTodayIsNotOverdue() {
        List<WorkItem> items = List.of(item(1, TODO_COL, 99L, WorkItemPriority.MEDIUM, 7L));
        List<RiskSignalResponse> signals = detect(items, List.of(activeSprint(7, TODAY)));
        assertThat(ofType(signals, RiskSignalType.SPRINT_OVERDUE)).isEmpty();
        assertThat(ofType(signals, RiskSignalType.SPRINT_AT_RISK)).hasSize(1); // 0 days left, all open
    }

    @Test
    void plannedSprintsNeverRaiseSprintSignals() {
        Sprint planned = new Sprint(PROJECT, "P", "g", TODAY.minusDays(10), TODAY.minusDays(1));
        set(planned, "id", 8L);
        assertThat(detect(List.of(open(1)), List.of(planned))).isEmpty();
    }

    @Test
    void sprintWithThreeDaysLeftAndMoreThanHalfOpenIsAtRisk() {
        List<WorkItem> items = List.of(
                item(1, TODO_COL, 99L, WorkItemPriority.MEDIUM, 7L),
                item(2, TODO_COL, 99L, WorkItemPriority.MEDIUM, 7L),
                item(3, DONE_COL, 99L, WorkItemPriority.MEDIUM, 7L));

        List<RiskSignalResponse> signals =
                ofType(detect(items, List.of(activeSprint(7, TODAY.plusDays(3)))), RiskSignalType.SPRINT_AT_RISK);

        assertThat(signals).hasSize(1);
        assertThat(signals.get(0).severity()).isEqualTo(RiskSeverity.MEDIUM);
        assertThat(signals.get(0).title()).contains("Sprint 7");
    }

    @Test
    void sprintWithFourDaysLeftIsNotAtRisk() {
        List<WorkItem> items = List.of(item(1, TODO_COL, 99L, WorkItemPriority.MEDIUM, 7L));
        assertThat(ofType(detect(items, List.of(activeSprint(7, TODAY.plusDays(4)))), RiskSignalType.SPRINT_AT_RISK))
                .isEmpty();
    }

    @Test
    void sprintWithExactlyHalfOpenIsNotAtRisk() {
        List<WorkItem> items = List.of(
                item(1, TODO_COL, 99L, WorkItemPriority.MEDIUM, 7L),
                item(2, DONE_COL, 99L, WorkItemPriority.MEDIUM, 7L));
        assertThat(ofType(detect(items, List.of(activeSprint(7, TODAY.plusDays(2)))), RiskSignalType.SPRINT_AT_RISK))
                .isEmpty();
    }

    @Test
    void sprintWithNoItemsIsNotAtRisk() {
        assertThat(ofType(detect(List.of(), List.of(activeSprint(7, TODAY.plusDays(1)))), RiskSignalType.SPRINT_AT_RISK))
                .isEmpty();
    }

    // ---- STALLED_ITEM ----

    private static WorkItem updatedAgo(WorkItem w, Duration ago) {
        return set(w, "updatedAt", OffsetDateTime.ofInstant(NOW.minus(ago), ZoneOffset.UTC));
    }

    @Test
    void itemUntouchedForExactlySevenDaysIsNotStalled() {
        WorkItem w = updatedAgo(open(1), Duration.ofDays(7));
        assertThat(ofType(detect(List.of(w), List.of()), RiskSignalType.STALLED_ITEM)).isEmpty();
    }

    @Test
    void itemUntouchedForMoreThanSevenDaysIsStalledMedium() {
        WorkItem w = updatedAgo(open(1), Duration.ofDays(7).plusSeconds(1));

        List<RiskSignalResponse> signals = ofType(detect(List.of(w), List.of()), RiskSignalType.STALLED_ITEM);

        assertThat(signals).hasSize(1);
        assertThat(signals.get(0).severity()).isEqualTo(RiskSeverity.MEDIUM);
        assertThat(signals.get(0).workItemId()).isEqualTo(1L);
    }

    @Test
    void staleDoneItemIsNotStalled() {
        WorkItem w = updatedAgo(item(1, DONE_COL, 99L, WorkItemPriority.MEDIUM, null), Duration.ofDays(30));
        assertThat(detect(List.of(w), List.of())).isEmpty();
    }

    // ---- UNASSIGNED_HIGH_PRIORITY ----

    @Test
    void unassignedUrgentIsHighAndUnassignedHighIsMedium() {
        WorkItem urgent = item(1, TODO_COL, null, WorkItemPriority.URGENT, null);
        WorkItem high = item(2, TODO_COL, null, WorkItemPriority.HIGH, null);

        List<RiskSignalResponse> signals =
                ofType(detect(List.of(urgent, high), List.of()), RiskSignalType.UNASSIGNED_HIGH_PRIORITY);

        assertThat(signals).hasSize(2);
        assertThat(signals)
                .filteredOn(s -> s.workItemId() == 1L)
                .extracting(RiskSignalResponse::severity)
                .containsExactly(RiskSeverity.HIGH);
        assertThat(signals)
                .filteredOn(s -> s.workItemId() == 2L)
                .extracting(RiskSignalResponse::severity)
                .containsExactly(RiskSeverity.MEDIUM);
    }

    @Test
    void assignedDoneOrLowerPriorityItemsAreNotFlagged() {
        List<WorkItem> items = List.of(
                item(1, TODO_COL, 5L, WorkItemPriority.URGENT, null),
                item(2, DONE_COL, null, WorkItemPriority.URGENT, null),
                item(3, TODO_COL, null, WorkItemPriority.MEDIUM, null),
                item(4, TODO_COL, null, WorkItemPriority.LOW, null));
        assertThat(ofType(detect(items, List.of()), RiskSignalType.UNASSIGNED_HIGH_PRIORITY)).isEmpty();
    }

    // ---- done-column resolution, ordering, cap ----

    @Test
    void withoutATerminadoColumnEveryItemCountsAsOpen() {
        List<BoardColumn> noDone = List.of(column(TODO_COL, "Por hacer"), column(DONE_COL, "Otro"));
        WorkItem w = item(1, DONE_COL, null, WorkItemPriority.URGENT, null);
        assertThat(detector.detect(List.of(w), noDone, List.of(), Map.of())).hasSize(1);
    }

    @Test
    void terminadoColumnNameMatchIsCaseInsensitive() {
        List<BoardColumn> cols = List.of(column(TODO_COL, "Por hacer"), column(DONE_COL, "TERMINADO"));
        WorkItem w = item(1, DONE_COL, null, WorkItemPriority.URGENT, null);
        assertThat(detector.detect(List.of(w), cols, List.of(), Map.of())).isEmpty();
    }

    @Test
    void signalsAreOrderedMostSevereFirst() {
        WorkItem high = item(1, TODO_COL, null, WorkItemPriority.HIGH, null); // MEDIUM
        WorkItem urgent = item(2, TODO_COL, null, WorkItemPriority.URGENT, null); // HIGH

        List<RiskSignalResponse> signals = detect(List.of(high, urgent), List.of());

        assertThat(signals)
                .extracting(RiskSignalResponse::severity)
                .containsExactly(RiskSeverity.HIGH, RiskSeverity.MEDIUM);
    }

    @Test
    void signalsAreCappedAtTwentyKeepingTheMostSevere() {
        List<WorkItem> items = new ArrayList<>();
        for (long i = 1; i <= 25; i++) {
            items.add(item(i, TODO_COL, null, WorkItemPriority.HIGH, null)); // 25 MEDIUM
        }
        items.add(item(100, TODO_COL, null, WorkItemPriority.URGENT, null)); // 1 HIGH, listed last

        List<RiskSignalResponse> signals = detect(items, List.of());

        assertThat(signals).hasSize(ProjectRiskDetector.MAX_SIGNALS).hasSize(20);
        assertThat(signals.get(0).workItemId()).isEqualTo(100L);
    }
}
