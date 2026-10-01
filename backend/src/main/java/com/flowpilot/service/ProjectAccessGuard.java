package com.flowpilot.service;

import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.WorkItemRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Central project-scoped access checks shared by the service layer. Each
 * method throws the same exception and message the per-service private copies
 * used to throw, so callers keep control of check ORDER (which decides 404 vs
 * 403) while the logic lives in one place.
 */
@Component
public class ProjectAccessGuard {

    private final ProjectAuthorizationService authorizationService;
    private final ProjectRepository projectRepository;
    private final WorkItemRepository workItemRepository;

    public ProjectAccessGuard(
            ProjectAuthorizationService authorizationService,
            ProjectRepository projectRepository,
            WorkItemRepository workItemRepository) {
        this.authorizationService = authorizationService;
        this.projectRepository = projectRepository;
        this.workItemRepository = workItemRepository;
    }

    /** 403 with the standard "Falta el permiso ..." message when the caller lacks {@code permission}. */
    public void requirePermission(Long userId, Long projectId, Permission permission) {
        if (!authorizationService.hasPermission(userId, projectId, permission)) {
            throw new AccessDeniedException("Falta el permiso " + permission + " en el proyecto " + projectId);
        }
    }

    /**
     * 404 when the project does not exist. Needed explicitly because {@code
     * canView}/{@code hasPermission} short-circuit for a global admin before
     * any project lookup.
     */
    public void requireProjectExists(Long projectId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ProjectNotFoundException(projectId);
        }
    }

    /** 403 with the caller-supplied message when the caller may not view the project. */
    public void requireCanView(Long userId, Long projectId, String deniedMessage) {
        if (!authorizationService.canView(userId, projectId)) {
            throw new AccessDeniedException(deniedMessage);
        }
    }

    /** Project-scoped work item lookup: an item of another project is reported as not found (404). */
    public WorkItem requireWorkItemInProject(Long workItemId, Long projectId) {
        return workItemRepository
                .findById(workItemId)
                .filter(item -> item.getProjectId().equals(projectId))
                .orElseThrow(() -> new WorkItemNotFoundException(workItemId));
    }
}
