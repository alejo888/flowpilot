package com.flowpilot.service;

import com.flowpilot.dto.SprintCreateRequest;
import com.flowpilot.dto.SprintResponse;
import com.flowpilot.dto.SprintUpdateRequest;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.SprintStatus;
import com.flowpilot.exception.InvalidSprintException;
import com.flowpilot.exception.SprintNotFoundException;
import com.flowpilot.repository.SprintRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SprintService {

    private static final String VIEW_DENIED_MESSAGE = "No autorizado para ver los sprints de este proyecto";

    private final SprintRepository sprintRepository;
    private final ProjectAccessGuard accessGuard;
    private final ProjectActivityService activityService;

    public SprintService(
            SprintRepository sprintRepository,
            ProjectAccessGuard accessGuard,
            ProjectActivityService activityService) {
        this.sprintRepository = sprintRepository;
        this.accessGuard = accessGuard;
        this.activityService = activityService;
    }

    @Transactional
    public SprintResponse create(Long projectId, SprintCreateRequest request, Long requesterId) {
        accessGuard.requirePermission(requesterId, projectId, Permission.SPRINT_MANAGE);
        validateDates(request.startDate(), request.endDate());
        accessGuard.requireProjectExists(projectId);
        Sprint sprint = new Sprint(
                projectId, request.name(), request.goal(), request.startDate(), request.endDate());
            SprintResponse response = toResponse(sprintRepository.save(sprint));
        activityService.record(projectId, requesterId, ActivityEventType.SPRINT_CREATED, "Se creó el sprint \"" + sprint.getName() + "\"", "{}");
            return response;
    }

    public List<SprintResponse> list(Long projectId, Long requesterId) {
        accessGuard.requireCanView(requesterId, projectId, VIEW_DENIED_MESSAGE);
        return sprintRepository.findByProjectIdOrderByStartDateAsc(projectId).stream()
                .map(SprintService::toResponse)
                .toList();
    }

    @Transactional
    public SprintResponse update(Long id, SprintUpdateRequest request, Long requesterId) {
        Sprint sprint = get(id);
        accessGuard.requirePermission(requesterId, sprint.getProjectId(), Permission.SPRINT_MANAGE);
        if (sprint.getStatus() != SprintStatus.PLANNED) {
            throw new InvalidSprintException("Solo los sprints planificados pueden actualizarse");
        }
        validateDates(request.startDate(), request.endDate());
        sprint.update(request.name(), request.goal(), request.startDate(), request.endDate());
        activityService.record(sprint.getProjectId(), requesterId, ActivityEventType.SPRINT_UPDATED, "Se actualizó el sprint \"" + sprint.getName() + "\"", "{}");
        return toResponse(sprint);
    }

    @Transactional
    public SprintResponse start(Long id, Long requesterId) {
        Sprint sprint = get(id);
        accessGuard.requirePermission(requesterId, sprint.getProjectId(), Permission.SPRINT_MANAGE);
        if (sprintRepository.existsByProjectIdAndStatus(sprint.getProjectId(), SprintStatus.ACTIVE)) {
            throw new InvalidSprintException("El proyecto ya tiene un sprint activo");
        }
        try {
            sprint.start();
            activityService.record(sprint.getProjectId(), requesterId, ActivityEventType.SPRINT_STARTED, "Se inició el sprint \"" + sprint.getName() + "\"", "{}");
        } catch (IllegalStateException ex) {
            throw new InvalidSprintException(ex.getMessage());
        }
        return toResponse(sprint);
    }

    @Transactional
    public SprintResponse complete(Long id, Long requesterId) {
        Sprint sprint = get(id);
        accessGuard.requirePermission(requesterId, sprint.getProjectId(), Permission.SPRINT_MANAGE);
        try {
            sprint.complete();
            activityService.record(sprint.getProjectId(), requesterId, ActivityEventType.SPRINT_COMPLETED, "Se completó el sprint \"" + sprint.getName() + "\"", "{}");
        } catch (IllegalStateException ex) {
            throw new InvalidSprintException(ex.getMessage());
        }
        return toResponse(sprint);
    }

    private Sprint get(Long id) {
        return sprintRepository.findById(id)
                .orElseThrow(() -> new SprintNotFoundException(id));
    }

    private static void validateDates(LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start)) {
            throw new InvalidSprintException("La fecha de fin debe ser posterior o igual a la fecha de inicio");
        }
    }

    static SprintResponse toResponse(Sprint sprint) {
        return new SprintResponse(
                sprint.getId(),
                sprint.getProjectId(),
                sprint.getName(),
                sprint.getGoal(),
                sprint.getStartDate(),
                sprint.getEndDate(),
                sprint.getStatus(),
                sprint.getCreatedAt(),
                sprint.getUpdatedAt());
    }
}
