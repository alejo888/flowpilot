package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.WorkItemCreateRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.dto.WorkItemUpdateRequest;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
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

    private ProjectAuthorizationService authorizationService;

    private WorkItemService workItemService;

    @BeforeEach
    void setUp() {
        authorizationService = mock(ProjectAuthorizationService.class);
        workItemService = new WorkItemService(workItemRepository, boardColumnRepository, authorizationService);
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

        WorkItemResponse response = workItemService.update(
                500L, new WorkItemUpdateRequest("New title", "New description", 42L), 1L);

        assertThat(response.title()).isEqualTo("New title");
        assertThat(response.description()).isEqualTo("New description");
        assertThat(response.assignedUserId()).isEqualTo(42L);
        assertThat(item.getColumnId()).isEqualTo(200L);
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
