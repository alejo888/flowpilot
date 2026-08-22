package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
        when(authorizationService.hasPermission(9L, 1L, Permission.WORKITEM_EDIT)).thenReturn(true);

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
        when(authorizationService.hasPermission(9L, 1L, Permission.WORKITEM_EDIT)).thenReturn(true);
        when(sprintRepository.existsByProjectIdAndStatus(1L, SprintStatus.ACTIVE)).thenReturn(false);

        SprintStatus status = service().start(1L, 9L).status();

        assertThat(status).isEqualTo(SprintStatus.ACTIVE);
    }

    @Test
    void rejectsStartingWhenProjectAlreadyHasActiveSprint() {
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint()));
        when(authorizationService.hasPermission(9L, 1L, Permission.WORKITEM_EDIT)).thenReturn(true);
        when(sprintRepository.existsByProjectIdAndStatus(1L, SprintStatus.ACTIVE)).thenReturn(true);

        assertThatThrownBy(() -> service().start(1L, 9L))
                .isInstanceOf(InvalidSprintException.class)
                .hasMessage("Project already has an active sprint");
    }

    @Test
    void completesActiveSprint() {
        Sprint sprint = sprint();
        sprint.start();
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint));
        when(authorizationService.hasPermission(9L, 1L, Permission.WORKITEM_EDIT)).thenReturn(true);

        SprintStatus status = service().complete(1L, 9L).status();

        assertThat(status).isEqualTo(SprintStatus.COMPLETED);
    }

    @Test
    void rejectsCompletingPlannedSprint() {
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint()));
        when(authorizationService.hasPermission(9L, 1L, Permission.WORKITEM_EDIT)).thenReturn(true);

        assertThatThrownBy(() -> service().complete(1L, 9L))
                .isInstanceOf(InvalidSprintException.class);
    }

    @Test
    void rejectsUpdatingCompletedSprint() {
        Sprint sprint = sprint();
        sprint.start();
        sprint.complete();
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint));
        when(authorizationService.hasPermission(9L, 1L, Permission.WORKITEM_EDIT)).thenReturn(true);

        assertThatThrownBy(() -> service().update(
                1L,
                new SprintUpdateRequest("Updated", null, LocalDate.now(), LocalDate.now().plusDays(7)),
                9L))
                .isInstanceOf(InvalidSprintException.class);
    }

    @Test
    void rejectsUnauthorizedLifecycleChange() {
        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint()));
        when(authorizationService.hasPermission(9L, 1L, Permission.WORKITEM_EDIT)).thenReturn(false);

        assertThatThrownBy(() -> service().start(1L, 9L))
                .isInstanceOf(AccessDeniedException.class);
    }

    private SprintService service() {
        return new SprintService(sprintRepository, projectRepository, authorizationService);
    }

    private Sprint sprint() {
        return new Sprint(
                1L, "Sprint", "Goal", LocalDate.now(), LocalDate.now().plusDays(7));
    }
}
