package com.flowpilot.service;

import com.flowpilot.dto.BoardColumnResponse;
import com.flowpilot.dto.ProjectCreateRequest;
import com.flowpilot.dto.ProjectResponse;
import com.flowpilot.dto.ProjectStatusUpdateRequest;
import com.flowpilot.dto.ProjectUpdateRequest;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.User;
import com.flowpilot.exception.DuplicateProjectCodeException;
import com.flowpilot.exception.InvalidProjectDatesException;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Project CRUD + lifecycle (spec: project-management). Writes funnel through
 * {@link ProjectAuthorizationService#hasPermission} — {@code
 * update}/{@code updateStatus} require {@link Permission#PROJECT_EDIT_SETTINGS};
 * {@code delete} requires {@link Permission#PROJECT_DELETE} (proposal's
 * Permission Catalog table; slice 8a, matrix-backed, confirmed decision 5b).
 */
@Service
public class ProjectService {

    /** Design D10: gap-based positions, 1024 step, so future inserts-between never re-sequence. */
    private static final int COLUMN_POSITION_STEP = 1024;
    /** Package-private so {@link ProjectDashboardService} can reuse the canonical "done" column name. */
    static final List<String> DEFAULT_COLUMN_NAMES =
            List.of("Por hacer", "En progreso", "En revisión", "Terminado");

    private final ProjectRepository projectRepository;
    private final BoardColumnRepository boardColumnRepository;
    private final UserRepository userRepository;
    private final ProjectAuthorizationService authorizationService;
    private final ProjectActivityService activityService;

    public ProjectService(
            ProjectRepository projectRepository,
            BoardColumnRepository boardColumnRepository,
            UserRepository userRepository,
            ProjectAuthorizationService authorizationService,
            ProjectActivityService activityService) {
        this.projectRepository = projectRepository;
        this.boardColumnRepository = boardColumnRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
        this.activityService = activityService;
    }

    @Transactional
    public ProjectResponse create(ProjectCreateRequest request, Long ownerId) {
        String code = trimToNull(request.code());
        validateDates(request.startDate(), request.estimatedEndDate());
        requireUniqueCode(code, null);

        Project project = new Project(request.name(), request.description(), ownerId);
        applyRichFields(project, code, request.startDate(), request.estimatedEndDate(),
                request.technologies(), request.repositoryUrl());

        project = projectRepository.save(project);
        seedDefaultColumns(project.getId());
        record(project.getId(), ownerId, ActivityEventType.PROJECT_CREATED, "Se creó el proyecto \"" + project.getName() + "\"");
        return toResponse(project, ownerId);
    }

    private void seedDefaultColumns(Long projectId) {
        for (int i = 0; i < DEFAULT_COLUMN_NAMES.size(); i++) {
            int position = COLUMN_POSITION_STEP * (i + 1);
            boardColumnRepository.save(new BoardColumn(projectId, DEFAULT_COLUMN_NAMES.get(i), position));
        }
    }

    public List<ProjectResponse> list(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        if (!user.isActive()) {
            throw new AccessDeniedException("La cuenta está desactivada");
        }
        List<Project> projects = user.getRole() == GlobalRole.ADMINISTRADOR
                ? projectRepository.findAll()
                : projectRepository.findVisibleToUser(userId);
        return projects.stream().map(p -> toResponse(p, userId)).toList();
    }

    public ProjectResponse findById(Long id, Long userId) {
        requireCanView(userId, id);
        return toResponse(getOrThrow(id), userId);
    }

    @Transactional
    public ProjectResponse update(Long id, ProjectUpdateRequest request, Long userId) {
        requirePermission(userId, id, Permission.PROJECT_EDIT_SETTINGS);
        Project project = getOrThrow(id);

        String code = trimToNull(request.code());
        validateDates(request.startDate(), request.estimatedEndDate());
        requireUniqueCode(code, id);

        project.setName(request.name());
        project.setDescription(request.description());
        applyRichFields(project, code, request.startDate(), request.estimatedEndDate(),
                request.technologies(), request.repositoryUrl());
        project.touch();
        record(id, userId, ActivityEventType.PROJECT_UPDATED, "Se actualizó el proyecto \"" + project.getName() + "\"");
        return toResponse(project, userId);
    }

    @Transactional
    public ProjectResponse updateStatus(Long id, ProjectStatusUpdateRequest request, Long userId) {
        requirePermission(userId, id, Permission.PROJECT_EDIT_SETTINGS);
        Project project = getOrThrow(id);
        project.setStatus(request.status());
        project.touch();
        record(id, userId, ActivityEventType.PROJECT_STATUS_CHANGED,
                "Se cambió el estado del proyecto \"" + project.getName() + "\" a " + request.status());
        return toResponse(project, userId);
    }

    @Transactional
    public void delete(Long id, Long userId) {
        requirePermission(userId, id, Permission.PROJECT_DELETE);
        Project project = getOrThrow(id);
        projectRepository.delete(project);
    }

    public List<BoardColumnResponse> listBoardColumns(Long projectId, Long userId) {
        requireCanView(userId, projectId);
        return boardColumnRepository.findByProjectIdOrderByPositionAsc(projectId).stream()
                .map(ProjectService::toColumnResponse)
                .toList();
    }

    private void requirePermission(Long userId, Long projectId, Permission permission) {
        if (!authorizationService.hasPermission(userId, projectId, permission)) {
            throw new AccessDeniedException("Falta el permiso " + permission + " en el proyecto " + projectId);
        }
    }

    /**
     * Closes the read-authorization gap flagged in the slice-3 verify report:
     * admin, owner, or a live {@code ProjectMember} may read a single
     * project's details/columns; everyone else gets 403.
     */
    private void requireCanView(Long userId, Long projectId) {
        if (!authorizationService.canView(userId, projectId)) {
            throw new AccessDeniedException("No autorizado para ver este proyecto");
        }
    }

    /**
     * Collapses a blank/whitespace-only optional string to {@code null}
     * (design A5) so it never occupies the partial unique index on {@code
     * lower(code)} and stays a clean no-op for {@code technologies}/{@code
     * repositoryUrl}.
     */
    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Cross-field date rule (spec: "Optional Planned Start and Estimated End
     * Dates"; design A2): only checked when both dates are present.
     */
    private static void validateDates(LocalDate startDate, LocalDate estimatedEndDate) {
        if (startDate != null && estimatedEndDate != null && startDate.isAfter(estimatedEndDate)) {
            throw new InvalidProjectDatesException();
        }
    }

    /**
     * Service-side pre-check ahead of the partial unique index backstop
     * (design A1). {@code excludeProjectId} is {@code null} on create; on
     * update it lets a project keep its own code (design A6).
     */
    private void requireUniqueCode(String code, Long excludeProjectId) {
        if (code == null) {
            return;
        }
        boolean duplicate = excludeProjectId == null
                ? projectRepository.existsByCodeIgnoreCase(code)
                : projectRepository.existsByCodeIgnoreCaseAndIdNot(code, excludeProjectId);
        if (duplicate) {
            throw new DuplicateProjectCodeException(code);
        }
    }

    /**
     * Shared by {@link #create} and {@link #update} (task 2.7 refactor):
     * applies the five rich fields to an entity, normalizing the two
     * free-text ones via {@link #trimToNull}. {@code code} is passed
     * pre-normalized so it can be validated once by the caller before this
     * point.
     */
    private static void applyRichFields(
            Project project, String code, LocalDate startDate, LocalDate estimatedEndDate,
            String technologies, String repositoryUrl) {
        project.setCode(code);
        project.setStartDate(startDate);
        project.setEstimatedEndDate(estimatedEndDate);
        project.setTechnologies(trimToNull(technologies));
        project.setRepositoryUrl(trimToNull(repositoryUrl));
    }

    private void record(Long projectId, Long actorId, ActivityEventType type, String text) {
        activityService.record(projectId, actorId, type, text, "{}");
    }


    private Project getOrThrow(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new ProjectNotFoundException(id));
    }

    private ProjectResponse toResponse(Project project, Long callerId) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getStatus(),
                project.getOwnerId(),
                project.getCreatedAt(),
                project.getUpdatedAt(),
                project.getCode(),
                project.getStartDate(),
                project.getEstimatedEndDate(),
                project.getTechnologies(),
                project.getRepositoryUrl(),
                authorizationService.permissionsFor(callerId, project.getId()));
    }

    private static BoardColumnResponse toColumnResponse(BoardColumn column) {
        return new BoardColumnResponse(column.getId(), column.getName(), column.getPosition());
    }
}
