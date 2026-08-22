package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.repository.BoardColumnRepository;
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
        var auth = Mockito.mock(ProjectAuthorizationService.class);
        when(auth.canView(7L, 10L)).thenReturn(true);
        BoardColumn todo = new BoardColumn(10L, "Por hacer", 1024);
        BoardColumn done = new BoardColumn(10L, "Terminado", 4096);
        setId(todo, 1L); setId(done, 2L);
        when(columns.findByProjectIdOrderByPositionAsc(10L)).thenReturn(List.of(todo, done));
        when(items.findByProjectIdOrderByColumnIdAscPositionAsc(10L)).thenReturn(List.of(
                new WorkItem(10L, 1L, "A", null, null, 1), new WorkItem(10L, 2L, "B", null, null, 1)));
        when(sprints.findByProjectIdOrderByStartDateAsc(10L)).thenReturn(List.of());

        var result = new ProjectDashboardService(items, columns, sprints, users, auth).get(10L, 7L);

        assertThat(result.totalItems()).isEqualTo(2);
        assertThat(result.completedItems()).isEqualTo(1);
        assertThat(result.backlogPendingCount()).isEqualTo(2);
        assertThat(result.priorityDistribution()).containsEntry("MEDIUM", 2L);
    }

    private static void setId(Object entity, Long id) {
        try { var field = entity.getClass().getDeclaredField("id"); field.setAccessible(true); field.set(entity, id); }
        catch (ReflectiveOperationException e) { throw new AssertionError(e); }
    }
}
