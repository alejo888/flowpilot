package com.flowpilot.service;

import com.flowpilot.dto.RiskSeverity;
import com.flowpilot.dto.RiskSignalResponse;
import com.flowpilot.dto.RiskSignalType;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.SprintStatus;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.entity.WorkItemPriority;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Deterministic project-risk detection (vision 7.6). Pure over already-loaded
 * data: work items, board columns and sprints go in, Spanish {@link
 * RiskSignalResponse}s come out. "Today" and staleness derive from an
 * injectable {@link Clock}, so every threshold is testable to the boundary.
 *
 * <p>"Done" is the column named like {@link ProjectService#DEFAULT_COLUMN_NAMES}'s
 * last entry ({@code Terminado}, case-insensitive) — the same convention as
 * {@link ProjectDashboardService}; a board without such a column has no done
 * items. Blocked tasks, dependencies, story points and per-task due dates are
 * out of scope: the schema holds no data for them.
 */
@Component
public class ProjectRiskDetector {

    static final int LARGE_STORY_MIN_CHILDREN = 5;
    static final int LARGE_STORY_HIGH_CHILDREN = 8;
    static final int OVERLOADED_MIN_OPEN = 8;
    static final int OVERLOADED_HIGH_OPEN = 12;
    static final int SPRINT_AT_RISK_DAYS_LEFT = 3;
    static final Duration STALLED_AFTER = Duration.ofDays(7);

    /**
     * Upper bound on the signals returned, and therefore on the AI context
     * size: a badly neglected project could otherwise emit hundreds of
     * per-item signals. The list is sorted most severe first before it is cut,
     * so the cap only ever drops the least important signals.
     */
    static final int MAX_SIGNALS = 20;

    private static final String DONE_COLUMN_NAME = ProjectService.DEFAULT_COLUMN_NAMES.getLast();

    private final Clock clock;

    public ProjectRiskDetector() {
        this(Clock.systemUTC());
    }

    ProjectRiskDetector(Clock clock) {
        this.clock = clock;
    }

    /**
     * @param userNames assignee id to display name, used only for readable
     *     text; an unknown id falls back to {@code usuario #id}
     * @return at most {@value #MAX_SIGNALS} signals, most severe first
     */
    public List<RiskSignalResponse> detect(
            List<WorkItem> items, List<BoardColumn> columns, List<Sprint> sprints, Map<Long, String> userNames) {
        Set<Long> doneColumnIds = columns.stream()
                .filter(c -> c.getName().equalsIgnoreCase(DONE_COLUMN_NAME))
                .map(BoardColumn::getId)
                .collect(Collectors.toSet());

        List<RiskSignalResponse> signals = new ArrayList<>();
        signals.addAll(largeStories(items));
        signals.addAll(overloadedMembers(items, doneColumnIds, userNames));
        signals.addAll(sprintSignals(items, sprints, doneColumnIds));
        signals.addAll(stalledItems(items, doneColumnIds));
        signals.addAll(unassignedHighPriority(items, doneColumnIds));

        return signals.stream()
                .sorted(Comparator.comparing(RiskSignalResponse::severity)) // stable: keeps detection order
                .limit(MAX_SIGNALS)
                .toList();
    }

    private static boolean isOpen(WorkItem item, Set<Long> doneColumnIds) {
        return !doneColumnIds.contains(item.getColumnId());
    }

    private List<RiskSignalResponse> largeStories(List<WorkItem> items) {
        Map<Long, Long> childCount = items.stream()
                .filter(i -> i.getParentWorkItemId() != null)
                .collect(Collectors.groupingBy(WorkItem::getParentWorkItemId, LinkedHashMap::new, Collectors.counting()));
        Map<Long, WorkItem> byId = new HashMap<>();
        items.forEach(i -> byId.put(i.getId(), i));

        List<RiskSignalResponse> out = new ArrayList<>();
        childCount.forEach((parentId, count) -> {
            WorkItem parent = byId.get(parentId);
            if (parent == null || count < LARGE_STORY_MIN_CHILDREN) {
                return;
            }
            RiskSeverity severity = count >= LARGE_STORY_HIGH_CHILDREN ? RiskSeverity.HIGH : RiskSeverity.MEDIUM;
            out.add(new RiskSignalResponse(
                    RiskSignalType.LARGE_STORY,
                    severity,
                    "Historia demasiado grande: \"" + parent.getTitle() + "\"",
                    "La historia \"" + parent.getTitle() + "\" tiene " + count
                            + " subtareas; conviene dividirla en historias más pequeñas.",
                    parent.getId(),
                    null));
        });
        return out;
    }

    private List<RiskSignalResponse> overloadedMembers(
            List<WorkItem> items, Set<Long> doneColumnIds, Map<Long, String> userNames) {
        Map<Long, Long> openByUser = items.stream()
                .filter(i -> i.getAssignedUserId() != null && isOpen(i, doneColumnIds))
                .collect(Collectors.groupingBy(WorkItem::getAssignedUserId, LinkedHashMap::new, Collectors.counting()));

        List<RiskSignalResponse> out = new ArrayList<>();
        openByUser.forEach((userId, count) -> {
            if (count < OVERLOADED_MIN_OPEN) {
                return;
            }
            String name = userNames.getOrDefault(userId, "usuario #" + userId);
            RiskSeverity severity = count >= OVERLOADED_HIGH_OPEN ? RiskSeverity.HIGH : RiskSeverity.MEDIUM;
            out.add(new RiskSignalResponse(
                    RiskSignalType.OVERLOADED_MEMBER,
                    severity,
                    "Miembro sobrecargado: " + name,
                    name + " tiene " + count + " tareas abiertas asignadas.",
                    null,
                    userId));
        });
        return out;
    }

    private List<RiskSignalResponse> sprintSignals(
            List<WorkItem> items, List<Sprint> sprints, Set<Long> doneColumnIds) {
        LocalDate today = LocalDate.now(clock);
        List<RiskSignalResponse> out = new ArrayList<>();
        for (Sprint sprint : sprints) {
            if (sprint.getStatus() != SprintStatus.ACTIVE || sprint.getEndDate() == null) {
                continue;
            }
            long daysLeft = ChronoUnit.DAYS.between(today, sprint.getEndDate());
            if (daysLeft < 0) {
                out.add(new RiskSignalResponse(
                        RiskSignalType.SPRINT_OVERDUE,
                        RiskSeverity.HIGH,
                        "Sprint vencido: " + sprint.getName(),
                        "El sprint \"" + sprint.getName() + "\" terminó el " + sprint.getEndDate()
                                + " y sigue activo.",
                        null,
                        null));
            } else if (daysLeft <= SPRINT_AT_RISK_DAYS_LEFT) {
                List<WorkItem> sprintItems = items.stream()
                        .filter(i -> sprint.getId().equals(i.getSprintId()))
                        .toList();
                long open = sprintItems.stream().filter(i -> isOpen(i, doneColumnIds)).count();
                if (!sprintItems.isEmpty() && open * 2 > sprintItems.size()) {
                    out.add(new RiskSignalResponse(
                            RiskSignalType.SPRINT_AT_RISK,
                            RiskSeverity.MEDIUM,
                            "Sprint en riesgo: " + sprint.getName(),
                            "Al sprint \"" + sprint.getName() + "\" le quedan " + daysLeft + " días y "
                                    + open + " de " + sprintItems.size() + " tareas siguen sin terminar.",
                            null,
                            null));
                }
            }
        }
        return out;
    }

    private List<RiskSignalResponse> stalledItems(List<WorkItem> items, Set<Long> doneColumnIds) {
        Instant threshold = clock.instant().minus(STALLED_AFTER);
        return items.stream()
                .filter(i -> isOpen(i, doneColumnIds)
                        && i.getUpdatedAt() != null
                        && i.getUpdatedAt().toInstant().isBefore(threshold))
                .map(i -> new RiskSignalResponse(
                        RiskSignalType.STALLED_ITEM,
                        RiskSeverity.MEDIUM,
                        "Tarea estancada: \"" + i.getTitle() + "\"",
                        "La tarea \"" + i.getTitle() + "\" no se ha modificado en más de "
                                + STALLED_AFTER.toDays() + " días y no está terminada.",
                        i.getId(),
                        null))
                .toList();
    }

    private List<RiskSignalResponse> unassignedHighPriority(List<WorkItem> items, Set<Long> doneColumnIds) {
        return items.stream()
                .filter(i -> i.getAssignedUserId() == null
                        && isOpen(i, doneColumnIds)
                        && (i.getPriority() == WorkItemPriority.URGENT || i.getPriority() == WorkItemPriority.HIGH))
                .map(i -> {
                    boolean urgent = i.getPriority() == WorkItemPriority.URGENT;
                    return new RiskSignalResponse(
                            RiskSignalType.UNASSIGNED_HIGH_PRIORITY,
                            urgent ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
                            "Tarea prioritaria sin responsable: \"" + i.getTitle() + "\"",
                            "La tarea \"" + i.getTitle() + "\" tiene prioridad " + i.getPriority()
                                    + " y no tiene responsable asignado.",
                            i.getId(),
                            null);
                })
                .toList();
    }
}
