package com.flowpilot.service;

import com.flowpilot.dto.SprintCreateRequest;
import com.flowpilot.dto.SprintResponse;
import com.flowpilot.dto.SprintUpdateRequest;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.SprintStatus;
import com.flowpilot.exception.InvalidSprintException;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.SprintNotFoundException;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.SprintRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SprintService {

    private final SprintRepository sprintRepository;
    private final ProjectRepository projectRepository;
    private final ProjectAuthorizationService authorizationService;
    private ProjectActivityService activityService;

    public SprintService(
            SprintRepository sprintRepository,
            ProjectRepository projectRepository,
            ProjectAuthorizationService authorizationService) {
        this.sprintRepository = sprintRepository;
        this.projectRepository = projectRepository;
        this.authorizationService = authorizationService;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setActivityService(ProjectActivityService service) { this.activityService = service; }

    @Transactional
    public SprintResponse create(Long projectId, SprintCreateRequest request, Long requesterId) {
        requirePermission(requesterId, projectId);
        validateDates(request.startDate(), request.endDate());
        requireProject(projectId);
        Sprint sprint = new Sprint(
                projectId, request.name(), request.goal(), request.startDate(), request.endDate());
            SprintResponse response = toResponse(sprintRepository.save(sprint));
            if (activityService != null) activityService.record(projectId, requesterId, ActivityEventType.SPRINT_CREATED, "Sprint created", "{}");
            return response;
    }

    public List<SprintResponse> list(Long projectId, Long requesterId) {
        requireView(requesterId, projectId);
        return sprintRepository.findByProjectIdOrderByStartDateAsc(projectId).stream()
                .map(SprintService::toResponse)
                .toList();
    }

    @Transactional
    public SprintResponse update(Long id, SprintUpdateRequest request, Long requesterId) {
        Sprint sprint = get(id);
        requirePermission(requesterId, sprint.getProjectId());
        if (sprint.getStatus() != SprintStatus.PLANNED) {
            throw new InvalidSprintException("Only planned sprints can be updated");
        }
        validateDates(request.startDate(), request.endDate());
        sprint.update(request.name(), request.goal(), request.startDate(), request.endDate());
            if (activityService != null) activityService.record(sprint.getProjectId(), requesterId, ActivityEventType.SPRINT_UPDATED, "Sprint updated", "{}");
        return toResponse(sprint);
    }

    @Transactional
    public SprintResponse start(Long id, Long requesterId) {
        Sprint sprint = get(id);
        requirePermission(requesterId, sprint.getProjectId());
        if (sprintRepository.existsByProjectIdAndStatus(sprint.getProjectId(), SprintStatus.ACTIVE)) {
            throw new InvalidSprintException("Project already has an active sprint");
        }
        try {
            sprint.start();
            if (activityService != null) activityService.record(sprint.getProjectId(), requesterId, ActivityEventType.SPRINT_STARTED, "Sprint started", "{}");
        } catch (IllegalStateException ex) {
            throw new InvalidSprintException(ex.getMessage());
        }
        return toResponse(sprint);
    }

    @Transactional
    public SprintResponse complete(Long id, Long requesterId) {
        Sprint sprint = get(id);
        requirePermission(requesterId, sprint.getProjectId());
        try {
            sprint.complete();
            if (activityService != null) activityService.record(sprint.getProjectId(), requesterId, ActivityEventType.SPRINT_COMPLETED, "Sprint completed", "{}");
        } catch (IllegalStateException ex) {
            throw new InvalidSprintException(ex.getMessage());
        }
        return toResponse(sprint);
    }

    private Sprint get(Long id) {
        return sprintRepository.findById(id)
                .orElseThrow(() -> new SprintNotFoundException(id));
    }

    private void requireProject(Long id) {
        if (!projectRepository.existsById(id)) {
            throw new ProjectNotFoundException(id);
        }
    }

    private void requirePermission(Long userId, Long projectId) {
        if (!authorizationService.hasPermission(userId, projectId, Permission.WORKITEM_EDIT)) {
            throw new AccessDeniedException("Missing WORKITEM_EDIT permission");
        }
    }

    private void requireView(Long userId, Long projectId) {
        if (!authorizationService.canView(userId, projectId)) {
            throw new AccessDeniedException("Not authorized to view project sprints");
        }
    }

    private static void validateDates(LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start)) {
            throw new InvalidSprintException("Sprint end date must be on or after start date");
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
