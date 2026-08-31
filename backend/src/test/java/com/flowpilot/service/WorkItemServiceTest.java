package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.BatchWorkItemLine;
import com.flowpilot.dto.WorkItemBatchCreateRequest;
import com.flowpilot.dto.WorkItemCreateRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.dto.WorkItemUpdateRequest;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.entity.WorkItemPriority;
import com.flowpilot.exception.InvalidSprintException;
import com.flowpilot.exception.ProjectMemberNotFoundException;
import com.flowpilot.exception.SprintNotFoundException;
    import com.flowpilot.exception.UserNotFoundException;
    import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
    import com.flowpilot.repository.SprintRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

/**
 * WorkItem CRUD logic (spec: work-items). Writes funnel through {@code
 * hasPermission} with the operation's specific {@link Permission}
 * ({@code WORKITEM_CREATE}/{@code WORKITEM_EDIT}/{@code WORKITEM_DELETE}) —
 * matrix-backed as of slice 8a. Reads are gated by {@code canView} (owner/
 * admin/member rule, unaffected). Create always targets the project's first
 * (lowest-position) {@link BoardColumn}, per spec's "Create work item"
 * scenario.
 */
@ExtendWith(MockitoExtension.class)
class WorkItemServiceTest {

    @Mock
    private WorkItemRepository workItemRepository;

    @Mock
    private BoardColumnRepository boardColumnRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SprintRepository sprintRepository;

    private ProjectAuthorizationService authorizationService;
    private ProjectActivityService activityService;

    private WorkItemService workItemService;

    @BeforeEach
    void setUp() {
        authorizationService = mock(ProjectAuthorizationService.class);
        activityService = mock(ProjectActivityService.class);
        workItemService = new WorkItemService(
                workItemRepository,
                boardColumnRepository,
                userRepository,
                authorizationService,
                sprintRepository);
        workItemService.setActivityService(activityService);
    }

    @Test
    void createLandsInFirstColumnWithInitialPosition() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L, new WorkItemCreateRequest("Design the schema", "First task", null), 1L);

        assertThat(response.columnId()).isEqualTo(200L);
        assertThat(response.position()).isEqualTo(1024);
        assertThat(response.title()).isEqualTo("Design the schema");
    }

    @Test
    void createSecondItemInColumnGetsNextGapPosition() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        WorkItem existing = workItem(500L, 10L, 200L, "Existing", 1024);
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.of(existing));
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response =
                workItemService.create(10L, new WorkItemCreateRequest("Second task", null, null), 1L);

        assertThat(response.position()).isEqualTo(2048);
    }

    @Test
    void createByUnauthorizedUserThrows403() {
        when(authorizationService.hasPermission(2L, 10L, Permission.WORKITEM_CREATE)).thenReturn(false);

        assertThatThrownBy(() -> workItemService.create(
                10L, new WorkItemCreateRequest("Task", null, null), 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void createByPlainProjectMemberSucceeds() throws Exception {
        when(authorizationService.hasPermission(3L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L, new WorkItemCreateRequest("Task by member", null, null), 3L);

        assertThat(response.title()).isEqualTo("Task by member");
    }

    @Test
    void findByIdReturnsItemForAuthorizedViewer() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Existing", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.canView(1L, 10L)).thenReturn(true);

        WorkItemResponse response = workItemService.findById(500L, 1L);

        assertThat(response.id()).isEqualTo(500L);
        assertThat(response.title()).isEqualTo("Existing");
    }

    @Test
    void findByIdWithoutViewPermissionThrows403() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Existing", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.canView(2L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> workItemService.findById(500L, 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void findByIdMissingThrows404() {
        when(workItemRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> workItemService.findById(999L, 1L))
                .isInstanceOf(WorkItemNotFoundException.class);
    }

    @Test
    void listReturnsItemsForAuthorizedViewer() throws Exception {
        when(authorizationService.canView(1L, 10L)).thenReturn(true);
        when(workItemRepository.findByProjectIdOrderByColumnIdAscPositionAsc(10L)).thenReturn(List.of(
                workItem(500L, 10L, 200L, "A", 1024),
                workItem(501L, 10L, 200L, "B", 2048)));

        List<WorkItemResponse> result = workItemService.list(10L, 1L);

        assertThat(result).extracting(WorkItemResponse::title).containsExactly("A", "B");
    }

    @Test
    void listByUnauthorizedViewerThrows403() {
        when(authorizationService.canView(2L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> workItemService.list(10L, 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void updateByAuthorizedUserSucceeds() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);
        when(authorizationService.canView(42L, 10L)).thenReturn(true);

        WorkItemResponse response = workItemService.update(
                500L, new WorkItemUpdateRequest("New title", "New description", 42L), 1L);

        assertThat(response.title()).isEqualTo("New title");
        assertThat(response.description()).isEqualTo("New description");
        assertThat(response.assignedUserId()).isEqualTo(42L);
        assertThat(item.getColumnId()).isEqualTo(200L);
    }

    @Test
    void updateWithoutPriorityPreservesStoredPriority() throws Exception {
        WorkItem item = new WorkItem(10L, 200L, "Old title", null, null, 1024, null, WorkItemPriority.HIGH);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        WorkItemResponse response = workItemService.update(
                500L, new WorkItemUpdateRequest("Updated title", null, null), 1L);

        assertThat(response.priority()).isEqualTo(WorkItemPriority.HIGH);
    }

    @Test
    void updateByPlainProjectMemberSucceeds() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(3L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        WorkItemResponse response = workItemService.update(
                500L, new WorkItemUpdateRequest("Member update", null, null), 3L);

        assertThat(response.title()).isEqualTo("Member update");
    }

    @Test
    void updateByUnauthorizedUserThrows403() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(2L, 10L, Permission.WORKITEM_EDIT)).thenReturn(false);

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("New title", null, null), 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void createAssignsItemToSprintInSameProject() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(sprintRepository.findByIdAndProjectId(7L, 10L))
                .thenReturn(Optional.of(new Sprint(10L, "Sprint", null,
                        java.time.LocalDate.now(), java.time.LocalDate.now().plusDays(7))));
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L, new WorkItemCreateRequest("Sprint task", null, null, 7L), 1L);

        assertThat(response.sprintId()).isEqualTo(7L);
    }

    @Test
    void createRejectsSprintFromAnotherProject() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(sprintRepository.findByIdAndProjectId(7L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> workItemService.create(
                10L, new WorkItemCreateRequest("Sprint task", null, null, 7L), 1L))
                .isInstanceOf(SprintNotFoundException.class);
    }

    @Test
    void createRejectsAssignmentToCompletedSprint() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(sprintRepository.findByIdAndProjectId(7L, 10L))
                .thenReturn(Optional.of(completedSprint(10L)));

        assertThatThrownBy(() -> workItemService.create(
                10L, new WorkItemCreateRequest("Sprint task", null, null, 7L), 1L))
                .isInstanceOf(InvalidSprintException.class);
    }

    @Test
    void updateRejectsAssignmentToCompletedSprint() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);
        when(sprintRepository.findByIdAndProjectId(7L, 10L))
                .thenReturn(Optional.of(completedSprint(10L)));

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("New title", null, null, 7L), 1L))
                .isInstanceOf(InvalidSprintException.class);
    }

    @Test
    void updateAllowsAssignmentToPlannedOrActiveSprint() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);
        Sprint activeSprint = new Sprint(10L, "Sprint", null,
                java.time.LocalDate.now(), java.time.LocalDate.now().plusDays(7));
        activeSprint.start();
        when(sprintRepository.findByIdAndProjectId(7L, 10L)).thenReturn(Optional.of(activeSprint));

        WorkItemResponse response = workItemService.update(
                500L, new WorkItemUpdateRequest("New title", null, null, 7L), 1L);

        assertThat(response.sprintId()).isEqualTo(7L);
    }

    private Sprint completedSprint(Long projectId) {
        Sprint sprint = new Sprint(projectId, "Sprint", null,
                java.time.LocalDate.now(), java.time.LocalDate.now().plusDays(7));
        sprint.start();
        sprint.complete();
        return sprint;
    }

    @Test
    void updateWithNullSprintMovesItemToBacklog() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Sprint task", 1024);
        item.setSprintId(7L);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        WorkItemResponse response = workItemService.update(
                500L, new WorkItemUpdateRequest("Backlog task", null, null, null), 1L);

        assertThat(response.sprintId()).isNull();
        assertThat(item.getSprintId()).isNull();
    }

    @Test
    void createWithNonexistentAssigneeThrowsProperExceptionNotFkViolation() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(authorizationService.canView(99L, 10L)).thenThrow(new UserNotFoundException(99L));

        assertThatThrownBy(() -> workItemService.create(
                10L, new WorkItemCreateRequest("Task", null, 99L), 1L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void createWithNonMemberAssigneeThrowsProperException() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(authorizationService.canView(42L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> workItemService.create(
                10L, new WorkItemCreateRequest("Task", null, 42L), 1L))
                .isInstanceOf(ProjectMemberNotFoundException.class);
    }

    @Test
    void createWithValidMemberAssigneeSucceeds() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        BoardColumn firstColumn = column(200L, 10L, 1024);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(firstColumn));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(authorizationService.canView(42L, 10L)).thenReturn(true);
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L, new WorkItemCreateRequest("Task", null, 42L), 1L);

        assertThat(response.assignedUserId()).isEqualTo(42L);
    }

    @Test
    void updateWithNonexistentAssigneeThrowsProperExceptionNotFkViolation() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);
        when(authorizationService.canView(99L, 10L)).thenThrow(new UserNotFoundException(99L));

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("New title", null, 99L), 1L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void updateWithNonMemberAssigneeThrowsProperException() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);
        when(authorizationService.canView(42L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("New title", null, 42L), 1L))
                .isInstanceOf(ProjectMemberNotFoundException.class);
    }

    @Test
    void deleteByAuthorizedUserSucceeds() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_DELETE)).thenReturn(true);

        workItemService.delete(500L, 1L);

        verify(workItemRepository).delete(item);
    }

    @Test
    void deleteByPlainProjectMemberSucceeds() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(3L, 10L, Permission.WORKITEM_DELETE)).thenReturn(true);

        workItemService.delete(500L, 3L);

        verify(workItemRepository).delete(item);
    }

    @Test
    void deleteByUnauthorizedUserThrows403() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(2L, 10L, Permission.WORKITEM_DELETE)).thenReturn(false);

        assertThatThrownBy(() -> workItemService.delete(500L, 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void createPersistsAcceptanceCriteriaInOrderAndDoesNotFoldThemIntoDescription() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L,
                new WorkItemCreateRequest("Historia", "Descripción base", null, null, null,
                        List.of("Dado A", "Cuando B", "Entonces C"), null, null, null),
                1L);

        assertThat(response.acceptanceCriteria()).containsExactly("Dado A", "Cuando B", "Entonces C");
        assertThat(response.description()).isEqualTo("Descripción base");
        assertThat(response.description()).doesNotContain("Dado A");
    }

    @Test
    void createWithoutAcceptanceCriteriaDefaultsToEmptyListNotNull() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L, new WorkItemCreateRequest("Sin criterios", null, null), 1L);

        assertThat(response.acceptanceCriteria()).isNotNull().isEmpty();
    }

    @Test
    void createRecordsClientAssertedAiProvenance() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L,
                new WorkItemCreateRequest("IA", "desc", null, null, null,
                        List.of("Un criterio"), true, "llama3", null),
                1L);

        assertThat(response.aiGenerated()).isTrue();
        assertThat(response.aiModel()).isEqualTo("llama3");
    }

    @Test
    void createRecordsStubProvenanceWithNullModel() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L,
                new WorkItemCreateRequest("IA stub", "desc", null, null, null,
                        List.of("Un criterio"), true, null, null),
                1L);

        assertThat(response.aiGenerated()).isTrue();
        assertThat(response.aiModel()).isNull();
    }

    @Test
    void manualCreateLeavesProvenanceFalseAndModelNull() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L, new WorkItemCreateRequest("Manual", "desc", null), 1L);

        assertThat(response.aiGenerated()).isFalse();
        assertThat(response.aiModel()).isNull();
    }

    @Test
    void updateReplacesAcceptanceCriteria() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Old title", 1024);
        item.setAcceptanceCriteria(List.of("A"));
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        WorkItemResponse response = workItemService.update(
                500L,
                new WorkItemUpdateRequest("New title", null, null, null, null, List.of("X", "Y"), null),
                1L);

        assertThat(response.acceptanceCriteria()).containsExactly("X", "Y");
        assertThat(item.getAcceptanceCriteria()).containsExactly("X", "Y");
    }

    // --- Single-level parent hierarchy (spec: work-item-hierarchy) ---

    @Test
    void createWithValidParentPersistsTheLink() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        WorkItem parent = workItem(900L, 10L, 200L, "Historia padre", 1024);
        when(workItemRepository.findById(900L)).thenReturn(Optional.of(parent));
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L,
                new WorkItemCreateRequest("Subtarea", null, null, null, null, List.of(), null, null, 900L),
                1L);

        assertThat(response.parentWorkItemId()).isEqualTo(900L);
        assertThat(response.parentWorkItemTitle()).isEqualTo("Historia padre");
    }

    @Test
    void createWithoutParentLeavesLinkNull() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L, new WorkItemCreateRequest("Suelta", null, null), 1L);

        assertThat(response.parentWorkItemId()).isNull();
        assertThat(response.parentWorkItemTitle()).isNull();
        assertThat(response.childCount()).isZero();
    }

    @Test
    void setParentToSelfIsRejected() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "X", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("X", null, null, null, null, List.of(), 500L), 1L))
                .isInstanceOf(com.flowpilot.exception.InvalidParentException.class);
    }

    @Test
    void parentFromAnotherProjectIsRejected() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "X", 1024);
        WorkItem foreignParent = workItem(900L, 99L, 800L, "Otro proyecto", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(workItemRepository.findById(900L)).thenReturn(Optional.of(foreignParent));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("X", null, null, null, null, List.of(), 900L), 1L))
                .isInstanceOf(com.flowpilot.exception.InvalidParentException.class);
    }

    @Test
    void missingParentIsRejectedAsNotFound() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "X", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(workItemRepository.findById(900L)).thenReturn(Optional.empty());
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("X", null, null, null, null, List.of(), 900L), 1L))
                .isInstanceOf(WorkItemNotFoundException.class);
    }

    @Test
    void parentThatIsItselfASubtaskIsRejected() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "X", 1024);
        WorkItem alreadyChildParent = workItem(900L, 10L, 200L, "Ya es subtarea", 1024);
        alreadyChildParent.setParentWorkItemId(700L);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(workItemRepository.findById(900L)).thenReturn(Optional.of(alreadyChildParent));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("X", null, null, null, null, List.of(), 900L), 1L))
                .isInstanceOf(com.flowpilot.exception.InvalidParentException.class);
    }

    @Test
    void itemThatAlreadyHasChildrenCannotBecomeASubtask() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Tiene hijos", 1024);
        WorkItem parent = workItem(900L, 10L, 200L, "Nuevo padre", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(workItemRepository.findById(900L)).thenReturn(Optional.of(parent));
        when(workItemRepository.existsByParentWorkItemId(500L)).thenReturn(true);
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        assertThatThrownBy(() -> workItemService.update(
                500L, new WorkItemUpdateRequest("Tiene hijos", null, null, null, null, List.of(), 900L), 1L))
                .isInstanceOf(com.flowpilot.exception.InvalidParentException.class);
    }

    @Test
    void updateCanClearAnExistingParentLink() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Child", 1024);
        item.setParentWorkItemId(900L);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        WorkItemResponse response = workItemService.update(
                500L, new WorkItemUpdateRequest("Child", null, null, null, null, List.of(), null), 1L);

        assertThat(response.parentWorkItemId()).isNull();
        assertThat(item.getParentWorkItemId()).isNull();
    }

    @Test
    void updateCanRepointToADifferentValidParent() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Child", 1024);
        item.setParentWorkItemId(900L);
        WorkItem newParent = workItem(901L, 10L, 200L, "Historia B", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(workItemRepository.findById(901L)).thenReturn(Optional.of(newParent));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_EDIT)).thenReturn(true);

        WorkItemResponse response = workItemService.update(
                500L, new WorkItemUpdateRequest("Child", null, null, null, null, List.of(), 901L), 1L);

        assertThat(response.parentWorkItemId()).isEqualTo(901L);
        assertThat(response.parentWorkItemTitle()).isEqualTo("Historia B");
    }

    @Test
    void childMayLiveInADifferentSprintThanItsParent() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        Sprint sprintTwo = new Sprint(10L, "Sprint 2", null,
                java.time.LocalDate.now(), java.time.LocalDate.now().plusDays(7));
        when(sprintRepository.findByIdAndProjectId(2L, 10L)).thenReturn(Optional.of(sprintTwo));
        WorkItem parentInSprintOne = workItem(900L, 10L, 200L, "Historia en sprint 1", 1024);
        parentInSprintOne.setSprintId(1L);
        when(workItemRepository.findById(900L)).thenReturn(Optional.of(parentInSprintOne));
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkItemResponse response = workItemService.create(
                10L,
                new WorkItemCreateRequest("Subtarea", null, null, 2L, null, List.of(), null, null, 900L),
                1L);

        assertThat(response.sprintId()).isEqualTo(2L);
        assertThat(response.parentWorkItemId()).isEqualTo(900L);
    }

    @Test
    void deleteIsBlockedWhenTheItemHasChildren() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Padre", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_DELETE)).thenReturn(true);
        when(workItemRepository.countByParentWorkItemId(500L)).thenReturn(3L);

        assertThatThrownBy(() -> workItemService.delete(500L, 1L))
                .isInstanceOf(com.flowpilot.exception.WorkItemHasChildrenException.class)
                .hasMessageContaining("tiene 3 subtareas.");
        verify(workItemRepository, org.mockito.Mockito.never()).delete(any(WorkItem.class));
    }

    @Test
    void deleteBlockedMessageUsesSingularForOneChild() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Padre", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_DELETE)).thenReturn(true);
        when(workItemRepository.countByParentWorkItemId(500L)).thenReturn(1L);

        assertThatThrownBy(() -> workItemService.delete(500L, 1L))
                .isInstanceOf(com.flowpilot.exception.WorkItemHasChildrenException.class)
                .hasMessageContaining("tiene 1 subtarea.");
    }

    @Test
    void deleteStillSucceedsForAChildlessItem() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, "Sin hijos", 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_DELETE)).thenReturn(true);
        when(workItemRepository.countByParentWorkItemId(500L)).thenReturn(0L);

        workItemService.delete(500L, 1L);

        verify(workItemRepository).delete(item);
    }

    @Test
    void listDerivesParentTitleAndChildCountInMemoryWithoutExtraQueries() throws Exception {
        when(authorizationService.canView(1L, 10L)).thenReturn(true);
        WorkItem parent = workItem(900L, 10L, 200L, "Historia X", 1024);
        WorkItem childA = workItem(901L, 10L, 200L, "Sub A", 2048);
        childA.setParentWorkItemId(900L);
        WorkItem childB = workItem(902L, 10L, 200L, "Sub B", 3072);
        childB.setParentWorkItemId(900L);
        when(workItemRepository.findByProjectIdOrderByColumnIdAscPositionAsc(10L))
                .thenReturn(List.of(parent, childA, childB));

        List<WorkItemResponse> result = workItemService.list(10L, 1L);

        WorkItemResponse parentResponse =
                result.stream().filter(r -> r.id().equals(900L)).findFirst().orElseThrow();
        WorkItemResponse childResponse =
                result.stream().filter(r -> r.id().equals(901L)).findFirst().orElseThrow();
        assertThat(parentResponse.childCount()).isEqualTo(2);
        assertThat(parentResponse.parentWorkItemTitle()).isNull();
        assertThat(childResponse.parentWorkItemTitle()).isEqualTo("Historia X");
        assertThat(childResponse.parentWorkItemId()).isEqualTo(900L);
        assertThat(childResponse.childCount()).isZero();
        verify(workItemRepository, org.mockito.Mockito.never()).countByParentWorkItemId(any());
    }

    // --- Transactional batch create (spec: ai-subtask-generation) ---

    private static BatchWorkItemLine line(String title) {
        return new BatchWorkItemLine(title, null, List.of(), null, null);
    }

    private WorkItemBatchCreateRequest batch(Long columnId, Long parentId, Long sprintId,
            Boolean aiGenerated, String aiModel, BatchWorkItemLine... lines) {
        return new WorkItemBatchCreateRequest(
                columnId, parentId, sprintId, aiGenerated, aiModel, List.of(lines));
    }

    @Test
    void createBatchRequiresWorkItemCreatePermission() {
        when(authorizationService.hasPermission(2L, 10L, Permission.WORKITEM_CREATE)).thenReturn(false);

        assertThatThrownBy(() -> workItemService.createBatch(
                10L, batch(200L, null, null, null, null, line("A")), 2L))
                .isInstanceOf(AccessDeniedException.class);
        verify(workItemRepository, never()).save(any(WorkItem.class));
    }

    @Test
    void createBatchWithUnknownColumnThrows404() {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> workItemService.createBatch(
                10L, batch(999L, null, null, null, null, line("A")), 1L))
                .isInstanceOf(com.flowpilot.exception.BoardColumnNotFoundException.class);
    }

    @Test
    void createBatchWithCrossProjectColumnThrows400() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(200L)).thenReturn(Optional.of(column(200L, 99L, 1024)));

        assertThatThrownBy(() -> workItemService.createBatch(
                10L, batch(200L, null, null, null, null, line("A")), 1L))
                .isInstanceOf(com.flowpilot.exception.CrossProjectColumnException.class);
        verify(workItemRepository, never()).save(any(WorkItem.class));
    }

    @Test
    void createBatchValidatesSprintOnceForTheWholeBatch() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(200L)).thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(sprintRepository.findByIdAndProjectId(7L, 10L)).thenReturn(Optional.of(completedSprint(10L)));

        assertThatThrownBy(() -> workItemService.createBatch(
                10L, batch(200L, null, 7L, null, null, line("A"), line("B"), line("C")), 1L))
                .isInstanceOf(InvalidSprintException.class);
        verify(sprintRepository, times(1)).findByIdAndProjectId(7L, 10L);
        verify(workItemRepository, never()).save(any(WorkItem.class));
    }

    @Test
    void createBatchValidatesParentOnceAtBatchLevelBeforeAnySave() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(200L)).thenReturn(Optional.of(column(200L, 10L, 1024)));
        WorkItem parentThatIsItselfASubtask = workItem(900L, 10L, 200L, "Ya es subtarea", 1024);
        parentThatIsItselfASubtask.setParentWorkItemId(700L);
        when(workItemRepository.findById(900L)).thenReturn(Optional.of(parentThatIsItselfASubtask));

        assertThatThrownBy(() -> workItemService.createBatch(
                10L, batch(200L, 900L, null, null, null, line("A"), line("B"), line("C")), 1L))
                .isInstanceOf(com.flowpilot.exception.InvalidParentException.class);
        verify(workItemRepository, never()).save(any(WorkItem.class));
    }

    @Test
    void createBatchLinksEveryCreatedRowToTheBatchParent() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(200L)).thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.findById(900L))
                .thenReturn(Optional.of(workItem(900L, 10L, 200L, "Historia padre", 1024)));
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WorkItemResponse> created = workItemService.createBatch(
                10L, batch(200L, 900L, null, null, null, line("A"), line("B"), line("C")), 1L);

        assertThat(created).allSatisfy(r -> assertThat(r.parentWorkItemId()).isEqualTo(900L));
    }

    @Test
    void createBatchWalksSequentialGapPositions() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(200L)).thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WorkItemResponse> created = workItemService.createBatch(
                10L, batch(200L, null, null, null, null, line("A"), line("B"), line("C")), 1L);

        assertThat(created).extracting(WorkItemResponse::position).containsExactly(1024, 2048, 3072);
        assertThat(created).extracting(WorkItemResponse::title).containsExactly("A", "B", "C");
        assertThat(created).allSatisfy(r -> assertThat(r.columnId()).isEqualTo(200L));
    }

    @Test
    void createBatchStampsBatchProvenanceOnEveryRow() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(200L)).thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(inv -> inv.getArgument(0));

        List<WorkItemResponse> created = workItemService.createBatch(
                10L, batch(200L, null, null, true, "llama3", line("A"), line("B")), 1L);

        assertThat(created).allSatisfy(r -> {
            assertThat(r.aiGenerated()).isTrue();
            assertThat(r.aiModel()).isEqualTo("llama3");
        });
    }

    @Test
    void createBatchRecordsOneCreatedActivityEventPerRow() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(200L)).thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(inv -> inv.getArgument(0));

        workItemService.createBatch(
                10L, batch(200L, null, null, null, null, line("A"), line("B"), line("C")), 1L);

        verify(activityService, times(3)).record(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(com.flowpilot.entity.ActivityEventType.WORK_ITEM_CREATED),
                org.mockito.ArgumentMatchers.startsWith("Se creó la tarea "),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void createBatchBadLinePropagatesAndSavesOnlyThePrecedingRows() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        when(boardColumnRepository.findById(200L)).thenReturn(Optional.of(column(200L, 10L, 1024)));
        when(workItemRepository.findFirstByColumnIdOrderByPositionDesc(200L)).thenReturn(Optional.empty());
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(authorizationService.canView(42L, 10L)).thenReturn(false);

        BatchWorkItemLine bad = new BatchWorkItemLine("C", null, List.of(), 42L, null);
        assertThatThrownBy(() -> workItemService.createBatch(
                10L, batch(200L, null, null, null, null, line("A"), line("B"), bad, line("D")), 1L))
                .isInstanceOf(ProjectMemberNotFoundException.class);

        verify(workItemRepository, times(2)).save(any(WorkItem.class));
        verify(activityService, times(2)).record(any(), any(), any(), org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    private WorkItem workItem(Long id, Long projectId, Long columnId, String title, int position) throws Exception {
        WorkItem item = new WorkItem(projectId, columnId, title, null, null, position);
        Field field = WorkItem.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(item, id);
        return item;
    }

    private BoardColumn column(Long id, Long projectId, int position) throws Exception {
        BoardColumn col = new BoardColumn(projectId, "Por hacer", position);
        Field field = BoardColumn.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(col, id);
        return col;
    }
}
