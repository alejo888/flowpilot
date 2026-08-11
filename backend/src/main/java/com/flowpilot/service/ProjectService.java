package com.flowpilot.service;

import com.flowpilot.dto.BoardColumnResponse;
import com.flowpilot.dto.ProjectCreateRequest;
import com.flowpilot.dto.ProjectResponse;
import com.flowpilot.dto.ProjectStatusUpdateRequest;
import com.flowpilot.dto.ProjectUpdateRequest;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.User;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.UserRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Project CRUD + lifecycle (spec: project-management). Every write funnels
 * through {@link ProjectAuthorizationService#isOwnerOrAdmin} — the interim
 * owner rule (design decision, slices 3-6).
 */
@Service
public class ProjectService {

    /** Design D10: gap-based positions, 1024 step, so future inserts-between never re-sequence. */
    private static final int COLUMN_POSITION_STEP = 1024;
    private static final List<String> DEFAULT_COLUMN_NAMES =
            List.of("Por hacer", "En progreso", "En revisión", "Terminado");

    private final ProjectRepository projectRepository;
    private final BoardColumnRepository boardColumnRepository;
    private final UserRepository userRepository;
    private final ProjectAuthorizationService authorizationService;

    public ProjectService(
            ProjectRepository projectRepository,
            BoardColumnRepository boardColumnRepository,
            UserRepository userRepository,
            ProjectAuthorizationService authorizationService) {
        this.projectRepository = projectRepository;
        this.boardColumnRepository = boardColumnRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
    }

    @Transactional
    public ProjectResponse create(ProjectCreateRequest request, Long ownerId) {
        Project project = new Project(request.name(), request.description(), ownerId);
        project = projectRepository.save(project);
        seedDefaultColumns(project.getId());
        return toResponse(project);
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
        List<Project> projects = user.getRole() == GlobalRole.ADMINISTRADOR
                ? projectRepository.findAll()
                : projectRepository.findByOwnerId(userId);
        return projects.stream().map(ProjectService::toResponse).toList();
    }

    public ProjectResponse findById(Long id, Long userId) {
        requireCanView(userId, id);
        return toResponse(getOrThrow(id));
    }

    @Transactional
    public ProjectResponse update(Long id, ProjectUpdateRequest request, Long userId) {
        requireOwnerOrAdmin(userId, id);
        Project project = getOrThrow(id);
        project.setName(request.name());
        project.setDescription(request.description());
        project.touch();
        return toResponse(project);
    }

    @Transactional
    public ProjectResponse updateStatus(Long id, ProjectStatusUpdateRequest request, Long userId) {
        requireOwnerOrAdmin(userId, id);
        Project project = getOrThrow(id);
        project.setStatus(request.status());
        project.touch();
        return toResponse(project);
    }

    @Transactional
    public void delete(Long id, Long userId) {
        requireOwnerOrAdmin(userId, id);
        Project project = getOrThrow(id);
        projectRepository.delete(project);
    }

    public List<BoardColumnResponse> listBoardColumns(Long projectId, Long userId) {
        requireCanView(userId, projectId);
        return boardColumnRepository.findByProjectIdOrderByPositionAsc(projectId).stream()
                .map(ProjectService::toColumnResponse)
                .toList();
    }

    private void requireOwnerOrAdmin(Long userId, Long projectId) {
        if (!authorizationService.isOwnerOrAdmin(userId, projectId)) {
            throw new AccessDeniedException("Not the project owner or an administrator");
        }
    }

    /**
     * Closes the read-authorization gap flagged in the slice-3 verify report:
     * admin, owner, or a live {@code ProjectMember} may read a single
     * project's details/columns; everyone else gets 403.
     */
    private void requireCanView(Long userId, Long projectId) {
        if (!authorizationService.canView(userId, projectId)) {
            throw new AccessDeniedException("Not authorized to view this project");
        }
    }

    private Project getOrThrow(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new ProjectNotFoundException(id));
    }

    private static ProjectResponse toResponse(Project project) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getStatus(),
                project.getOwnerId(),
                project.getCreatedAt(),
                project.getUpdatedAt());
    }

    private static BoardColumnResponse toColumnResponse(BoardColumn column) {
        return new BoardColumnResponse(column.getId(), column.getName(), column.getPosition());
    }
}
