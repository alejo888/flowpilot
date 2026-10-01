package com.flowpilot.service;

import com.flowpilot.dto.GeneratedUserStoryResponse;
import com.flowpilot.entity.Permission;
import org.springframework.stereotype.Service;

/**
 * Application-layer entry point for AI user-story generation (spec:
 * ai-user-story-generation). Keeps authorization in a {@code @Service} exactly
 * like {@link WorkItemService#create} rather than in the controller: a caller
 * must hold project {@link Permission#WORKITEM_CREATE} — the same permission
 * that gates creating the work item they will confirm the draft into.
 *
 * <p>An unknown {@code projectId} yields {@link ProjectNotFoundException}
 * (HTTP 404) up front, before the permission check, so the result does not
 * depend on the caller's global role (a global admin would otherwise
 * short-circuit {@link ProjectAuthorizationService#hasPermission} to {@code
 * true} without ever touching the project row). Generation persists nothing.
 */
@Service
public class AiUserStoryService {

    private final ProjectAccessGuard accessGuard;
    private final AiPlanningService aiPlanningService;

    public AiUserStoryService(ProjectAccessGuard accessGuard, AiPlanningService aiPlanningService) {
        this.accessGuard = accessGuard;
        this.aiPlanningService = aiPlanningService;
    }

    /**
     * @param projectId project the draft is scoped to; must exist
     * @param requirement free-text requirement, already length-validated by the controller
     * @param requesterId the authenticated caller
     * @return a non-persisted draft
     * @throws ProjectNotFoundException if {@code projectId} is unknown
     * @throws AccessDeniedException if the caller lacks {@link Permission#WORKITEM_CREATE}
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     */
    public GeneratedUserStoryResponse generate(Long projectId, String requirement, Long requesterId) {
        accessGuard.requireProjectExists(projectId);
        accessGuard.requirePermission(requesterId, projectId, Permission.WORKITEM_CREATE);
        return aiPlanningService.generateUserStory(requirement);
    }
}
