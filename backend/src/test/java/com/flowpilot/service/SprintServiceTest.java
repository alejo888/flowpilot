package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.SprintCreateRequest;
import com.flowpilot.dto.SprintUpdateRequest;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.SprintStatus;
import com.flowpilot.exception.InvalidSprintException;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.SprintRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class SprintServiceTest {

    @Mock
    private SprintRepository sprintRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Test
    void rejectsInvalidDateRange() {
        SprintService service = service();
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(true);

        assertThatThrownBy(() -> service.create(
                1L,
                new SprintCreateRequest(
                        "Sprint", "Goal", LocalDate.of(2026, 2, 1), LocalDate.of(2026, 1, 1)),
                9L))
                .isInstanceOf(InvalidSprintException.class);
    }

    @Test
    void startsPlannedSprint() {
        Sprint sprint = sprint();
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint));
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(true);
        when(sprintRepository.existsByProjectIdAndStatus(1L, SprintStatus.ACTIVE)).thenReturn(false);

        SprintStatus status = service().start(1L, 9L).status();

        assertThat(status).isEqualTo(SprintStatus.ACTIVE);
    }

    @Test
    void rejectsStartingWhenProjectAlreadyHasActiveSprint() {
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint()));
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(true);
        when(sprintRepository.existsByProjectIdAndStatus(1L, SprintStatus.ACTIVE)).thenReturn(true);

        assertThatThrownBy(() -> service().start(1L, 9L))
                .isInstanceOf(InvalidSprintException.class)
                .hasMessage("El proyecto ya tiene un sprint activo");
    }

    @Test
    void completesActiveSprint() {
        Sprint sprint = sprint();
        sprint.start();
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint));
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(true);

        SprintStatus status = service().complete(1L, 9L).status();

        assertThat(status).isEqualTo(SprintStatus.COMPLETED);
    }

    @Test
    void rejectsCompletingPlannedSprint() {
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint()));
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(true);

        assertThatThrownBy(() -> service().complete(1L, 9L))
                .isInstanceOf(InvalidSprintException.class);
    }

    @Test
    void rejectsUpdatingCompletedSprint() {
        Sprint sprint = sprint();
        sprint.start();
        sprint.complete();
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint));
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(true);

        assertThatThrownBy(() -> service().update(
                1L,
                new SprintUpdateRequest("Updated", null, LocalDate.now(), LocalDate.now().plusDays(7)),
                9L))
                .isInstanceOf(InvalidSprintException.class);
    }

    @Test
    void rejectsUnauthorizedLifecycleChange() {
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint()));
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(false);

        assertThatThrownBy(() -> service().start(1L, 9L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void rejectsCreateWithoutSprintManagePermission() {
        // A DEVELOPER/QA/UX/DEVOPS member holds WORKITEM_EDIT but not
        // SPRINT_MANAGE, so sprint creation must be denied.
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(false);

        assertThatThrownBy(() -> service().create(
                1L,
                new SprintCreateRequest(
                        "Sprint", "Goal", LocalDate.now(), LocalDate.now().plusDays(7)),
                9L))
                .isInstanceOf(AccessDeniedException.class);

        verify(sprintRepository, never()).save(any());
    }

    @Test
    void rejectsUpdateWithoutSprintManagePermission() {
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint()));
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(false);

        assertThatThrownBy(() -> service().update(
                1L,
                new SprintUpdateRequest("Updated", null, LocalDate.now(), LocalDate.now().plusDays(7)),
                9L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void rejectsCompleteWithoutSprintManagePermission() {
        Sprint sprint = sprint();
        sprint.start();
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint));
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(false);

        assertThatThrownBy(() -> service().complete(1L, 9L))
                .isInstanceOf(AccessDeniedException.class);

        assertThat(sprint.getStatus()).isEqualTo(SprintStatus.ACTIVE);
    }

    @Test
    void createsSprintWhenCallerHasSprintManagePermission() {
        when(authorizationService.hasPermission(9L, 1L, Permission.SPRINT_MANAGE)).thenReturn(true);
        when(projectRepository.existsById(1L)).thenReturn(true);
        when(sprintRepository.save(any(Sprint.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service().create(
                1L,
                new SprintCreateRequest(
                        "Sprint", "Goal", LocalDate.now(), LocalDate.now().plusDays(7)),
                9L);

        assertThat(response.status()).isEqualTo(SprintStatus.PLANNED);
    }

    private SprintService service() {
        return new SprintService(sprintRepository, projectRepository, authorizationService);
    }

    private Sprint sprint() {
        return new Sprint(
                1L, "Sprint", "Goal", LocalDate.now(), LocalDate.now().plusDays(7));
    }
}
