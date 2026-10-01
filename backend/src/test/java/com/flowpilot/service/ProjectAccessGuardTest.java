package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class ProjectAccessGuardTest {

    private static final Long USER_ID = 7L;
    private static final Long PROJECT_ID = 10L;

    private ProjectAuthorizationService authorizationService;
    private ProjectRepository projectRepository;
    private WorkItemRepository workItemRepository;
    private ProjectAccessGuard guard;

    @BeforeEach
    void setUp() {
        authorizationService = mock(ProjectAuthorizationService.class);
        projectRepository = mock(ProjectRepository.class);
        workItemRepository = mock(WorkItemRepository.class);
        guard = new ProjectAccessGuard(authorizationService, projectRepository, workItemRepository);
    }

    @Test
    void requirePermissionPassesWhenGranted() {
        when(authorizationService.hasPermission(USER_ID, PROJECT_ID, Permission.WORKITEM_EDIT)).thenReturn(true);

        assertThatCode(() -> guard.requirePermission(USER_ID, PROJECT_ID, Permission.WORKITEM_EDIT))
                .doesNotThrowAnyException();
    }

    @Test
    void requirePermissionDeniesWithStandardMessage() {
        when(authorizationService.hasPermission(USER_ID, PROJECT_ID, Permission.WORKITEM_EDIT)).thenReturn(false);

        assertThatThrownBy(() -> guard.requirePermission(USER_ID, PROJECT_ID, Permission.WORKITEM_EDIT))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("Falta el permiso WORKITEM_EDIT en el proyecto 10");
    }

    @Test
    void requireProjectExistsPassesWhenPresent() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);

        assertThatCode(() -> guard.requireProjectExists(PROJECT_ID)).doesNotThrowAnyException();
    }

    @Test
    void requireProjectExistsThrowsNotFoundWhenMissing() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(false);

        assertThatThrownBy(() -> guard.requireProjectExists(PROJECT_ID))
                .isInstanceOf(ProjectNotFoundException.class)
                .hasMessage(new ProjectNotFoundException(PROJECT_ID).getMessage());
    }

    @Test
    void requireCanViewPassesWhenAllowed() {
        when(authorizationService.canView(USER_ID, PROJECT_ID)).thenReturn(true);

        assertThatCode(() -> guard.requireCanView(USER_ID, PROJECT_ID, "denied")).doesNotThrowAnyException();
    }

    @Test
    void requireCanViewDeniesWithCallerMessage() {
        when(authorizationService.canView(USER_ID, PROJECT_ID)).thenReturn(false);

        assertThatThrownBy(() -> guard.requireCanView(USER_ID, PROJECT_ID, "No autorizado para ver esto"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("No autorizado para ver esto");
    }

    @Test
    void requireWorkItemInProjectReturnsItemOfSameProject() {
        WorkItem item = mock(WorkItem.class);
        when(item.getProjectId()).thenReturn(PROJECT_ID);
        when(workItemRepository.findById(5L)).thenReturn(Optional.of(item));

        assertThat(guard.requireWorkItemInProject(5L, PROJECT_ID)).isSameAs(item);
    }

    @Test
    void requireWorkItemInProjectThrowsNotFoundWhenMissing() {
        when(workItemRepository.findById(5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> guard.requireWorkItemInProject(5L, PROJECT_ID))
                .isInstanceOf(WorkItemNotFoundException.class)
                .hasMessage(new WorkItemNotFoundException(5L).getMessage());
    }

    @Test
    void requireWorkItemInProjectTreatsCrossProjectItemAsNotFound() {
        WorkItem item = mock(WorkItem.class);
        when(item.getProjectId()).thenReturn(99L);
        when(workItemRepository.findById(5L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> guard.requireWorkItemInProject(5L, PROJECT_ID))
                .isInstanceOf(WorkItemNotFoundException.class);
        verifyNoInteractions(authorizationService);
    }
}
