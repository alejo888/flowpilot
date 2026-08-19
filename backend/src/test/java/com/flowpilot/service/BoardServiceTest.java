package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.WorkItemMoveRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.BoardColumnNotFoundException;
import com.flowpilot.exception.CrossProjectColumnException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
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
 * WorkItem move logic (spec: kanban-board, "WorkItem move" requirement).
 * Gap-based positioning (design D10, 1024 step): a normal move computes a
 * position strictly between its new neighbours; the target column is fully
 * re-sequenced only when the computed gap would be {@code < 2}. Authorization
 * reuses {@link ProjectAuthorizationService#canManageWorkItems} — the same
 * gate as other WorkItem writes (any project member, not owner/admin-only).
 */
@ExtendWith(MockitoExtension.class)
class BoardServiceTest {

    @Mock
    private WorkItemRepository workItemRepository;

    @Mock
    private BoardColumnRepository boardColumnRepository;

    @Mock
    private UserRepository userRepository;

    private ProjectAuthorizationService authorizationService;

    private BoardService boardService;

    @BeforeEach
    void setUp() {
        authorizationService = mock(ProjectAuthorizationService.class);
        boardService = new BoardService(workItemRepository, boardColumnRepository, userRepository, authorizationService);
    }

    @Test
    void moveToEmptyColumnGetsFirstGapPosition() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, 1024);
        BoardColumn targetColumn = column(300L, 10L, 2048);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_MOVE)).thenReturn(true);
        when(boardColumnRepository.findById(300L)).thenReturn(Optional.of(targetColumn));
        when(workItemRepository.findByColumnIdOrderByPositionAsc(300L)).thenReturn(List.of());

        WorkItemResponse response = boardService.move(500L, new WorkItemMoveRequest(300L, 0), 1L);

        assertThat(response.columnId()).isEqualTo(300L);
        assertThat(response.position()).isEqualTo(1024);
    }

    @Test
    void moveBetweenTwoSiblingsWithAdequateGapUsesMidpoint() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, 1024);
        BoardColumn targetColumn = column(300L, 10L, 2048);
        WorkItem before = workItem(600L, 10L, 300L, 1024);
        WorkItem after = workItem(601L, 10L, 300L, 3072);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_MOVE)).thenReturn(true);
        when(boardColumnRepository.findById(300L)).thenReturn(Optional.of(targetColumn));
        when(workItemRepository.findByColumnIdOrderByPositionAsc(300L)).thenReturn(List.of(before, after));

        WorkItemResponse response = boardService.move(500L, new WorkItemMoveRequest(300L, 1), 1L);

        assertThat(response.position()).isEqualTo(2048);
        assertThat(before.getPosition()).isEqualTo(1024);
        assertThat(after.getPosition()).isEqualTo(3072);
    }

    @Test
    void moveAppendsAtEndOfColumnAfterLastSibling() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, 1024);
        BoardColumn targetColumn = column(300L, 10L, 2048);
        WorkItem onlySibling = workItem(600L, 10L, 300L, 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_MOVE)).thenReturn(true);
        when(boardColumnRepository.findById(300L)).thenReturn(Optional.of(targetColumn));
        when(workItemRepository.findByColumnIdOrderByPositionAsc(300L)).thenReturn(List.of(onlySibling));

        WorkItemResponse response = boardService.move(500L, new WorkItemMoveRequest(300L, 1), 1L);

        assertThat(response.position()).isEqualTo(2048);
    }

    @Test
    void moveWithExhaustedGapResequencesColumnOnly() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, 1024);
        BoardColumn targetColumn = column(300L, 10L, 2048);
        WorkItem before = workItem(600L, 10L, 300L, 1024);
        WorkItem after = workItem(601L, 10L, 300L, 1025);
        WorkItem tail = workItem(602L, 10L, 300L, 2049);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_MOVE)).thenReturn(true);
        when(boardColumnRepository.findById(300L)).thenReturn(Optional.of(targetColumn));
        when(workItemRepository.findByColumnIdOrderByPositionAsc(300L))
                .thenReturn(List.of(before, after, tail));

        WorkItemResponse response = boardService.move(500L, new WorkItemMoveRequest(300L, 1), 1L);

        assertThat(before.getPosition()).isEqualTo(1024);
        assertThat(response.position()).isEqualTo(2048);
        assertThat(after.getPosition()).isEqualTo(3072);
        assertThat(tail.getPosition()).isEqualTo(4096);
    }

    @Test
    void moveByUnauthorizedUserThrows403() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(2L, 10L, Permission.WORKITEM_MOVE)).thenReturn(false);

        assertThatThrownBy(() -> boardService.move(500L, new WorkItemMoveRequest(300L, 0), 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void moveMissingItemThrows404() {
        when(workItemRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> boardService.move(999L, new WorkItemMoveRequest(300L, 0), 1L))
                .isInstanceOf(WorkItemNotFoundException.class);
    }

    @Test
    void moveToMissingColumnThrows404() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_MOVE)).thenReturn(true);
        when(boardColumnRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> boardService.move(500L, new WorkItemMoveRequest(999L, 0), 1L))
                .isInstanceOf(BoardColumnNotFoundException.class);
    }

    @Test
    void moveToColumnFromDifferentProjectThrowsCrossProjectException() throws Exception {
        WorkItem item = workItem(500L, 10L, 200L, 1024);
        BoardColumn foreignColumn = column(300L, 99L, 1024);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_MOVE)).thenReturn(true);
        when(boardColumnRepository.findById(300L)).thenReturn(Optional.of(foreignColumn));

        assertThatThrownBy(() -> boardService.move(500L, new WorkItemMoveRequest(300L, 0), 1L))
                .isInstanceOf(CrossProjectColumnException.class);
        assertThat(item.getColumnId()).isEqualTo(200L);
        assertThat(item.getPosition()).isEqualTo(1024);
    }

    private WorkItem workItem(Long id, Long projectId, Long columnId, int position) throws Exception {
        WorkItem item = new WorkItem(projectId, columnId, "Task " + id, null, null, position);
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
