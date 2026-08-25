package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.SprintRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ProjectDashboardServiceTest {
    @Test
    void aggregatesColumnsPrioritiesAndBacklog() {
        var items = Mockito.mock(WorkItemRepository.class);
        var columns = Mockito.mock(BoardColumnRepository.class);
        var sprints = Mockito.mock(SprintRepository.class);
        var users = Mockito.mock(UserRepository.class);
        var projects = Mockito.mock(ProjectRepository.class);
        var auth = Mockito.mock(ProjectAuthorizationService.class);
        when(auth.canView(7L, 10L)).thenReturn(true);
        when(projects.existsById(10L)).thenReturn(true);
        BoardColumn todo = new BoardColumn(10L, "Por hacer", 1024);
        BoardColumn done = new BoardColumn(10L, "Terminado", 4096);
        setId(todo, 1L); setId(done, 2L);
        when(columns.findByProjectIdOrderByPositionAsc(10L)).thenReturn(List.of(todo, done));
        when(items.findByProjectIdOrderByColumnIdAscPositionAsc(10L)).thenReturn(List.of(
                new WorkItem(10L, 1L, "A", null, null, 1), new WorkItem(10L, 2L, "B", null, null, 1)));
        when(sprints.findByProjectIdOrderByStartDateAsc(10L)).thenReturn(List.of());

        var result = new ProjectDashboardService(items, columns, sprints, users, projects, auth).get(10L, 7L);

        assertThat(result.totalItems()).isEqualTo(2);
        assertThat(result.completedItems()).isEqualTo(1);
        assertThat(result.backlogPendingCount()).isEqualTo(2);
        assertThat(result.priorityDistribution()).containsEntry("MEDIUM", 2L);
    }

    /**
     * A global ADMINISTRADOR short-circuits {@code canView} to {@code true} before its
     * internal project lookup runs, so the dashboard must do its own existence check —
     * otherwise an unknown projectId returns a fabricated all-zero 200 instead of 404.
     */
    @Test
    void unknownProjectThrowsNotFoundEvenForGlobalAdmin() {
        var items = Mockito.mock(WorkItemRepository.class);
        var columns = Mockito.mock(BoardColumnRepository.class);
        var sprints = Mockito.mock(SprintRepository.class);
        var users = Mockito.mock(UserRepository.class);
        var projects = Mockito.mock(ProjectRepository.class);
        var auth = Mockito.mock(ProjectAuthorizationService.class);
        when(auth.canView(7L, 999L)).thenReturn(true); // admin bypass
        when(projects.existsById(999L)).thenReturn(false);

        var service = new ProjectDashboardService(items, columns, sprints, users, projects, auth);

        assertThatThrownBy(() -> service.get(999L, 7L))
                .isInstanceOf(ProjectNotFoundException.class)
                .hasMessageContaining("999");
        Mockito.verifyNoInteractions(items, columns, sprints, users);
    }

    /**
     * Documents the current limitation (see {@code ProjectDashboardService#DONE_COLUMN_NAME}):
     * completion metrics only recognize a column named exactly "Terminado" (case-insensitive).
     * A project whose final column has any other name reports 0 completed items even though
     * the item sits in the last column of the board.
     */
    @Test
    void completionCountsRequireExactDoneColumnName() {
        var items = Mockito.mock(WorkItemRepository.class);
        var columns = Mockito.mock(BoardColumnRepository.class);
        var sprints = Mockito.mock(SprintRepository.class);
        var users = Mockito.mock(UserRepository.class);
        var projects = Mockito.mock(ProjectRepository.class);
        var auth = Mockito.mock(ProjectAuthorizationService.class);
        when(auth.canView(7L, 10L)).thenReturn(true);
        when(projects.existsById(10L)).thenReturn(true);
        BoardColumn todo = new BoardColumn(10L, "Por hacer", 1024);
        BoardColumn done = new BoardColumn(10L, "Done", 4096); // not the exact expected name
        setId(todo, 1L); setId(done, 2L);
        when(columns.findByProjectIdOrderByPositionAsc(10L)).thenReturn(List.of(todo, done));
        when(items.findByProjectIdOrderByColumnIdAscPositionAsc(10L)).thenReturn(List.of(
                new WorkItem(10L, 2L, "A", null, null, 1)));
        when(sprints.findByProjectIdOrderByStartDateAsc(10L)).thenReturn(List.of());

        var result = new ProjectDashboardService(items, columns, sprints, users, projects, auth).get(10L, 7L);

        assertThat(result.totalItems()).isEqualTo(1);
        assertThat(result.completedItems()).isEqualTo(0);
    }

    private static void setId(Object entity, Long id) {
        try { var field = entity.getClass().getDeclaredField("id"); field.setAccessible(true); field.set(entity, id); }
        catch (ReflectiveOperationException e) { throw new AssertionError(e); }
    }
}
