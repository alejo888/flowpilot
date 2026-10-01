package com.flowpilot.service;

import com.flowpilot.dto.GenerateAcceptanceCriteriaRequest;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
import org.springframework.stereotype.Service;

/**
 * Application-layer entry point for AI story improvement (vision 7.7): the
 * model reviews an <em>existing</em> work item and proposes a rewritten
 * {@code Como … quiero … para …} story plus acceptance criteria. Mirrors {@link
 * AiAcceptanceCriteriaService}: authorization lives here, never in the
 * controller, and nothing is persisted.
 *
 * <p>Guarded by {@link Permission#WORKITEM_EDIT}: the caller applies the draft
 * through the existing {@code PUT /api/work-items/{id}} ({@link
 * WorkItemService#update}), which is {@code WORKITEM_EDIT}-guarded.
 *
 * <p>Check order, 404 strictly before 403 so the endpoint never confirms a work
 * item's existence in a project the caller did not name:
 * <ol>
 *   <li>project exists → {@link ProjectNotFoundException} (404)</li>
 *   <li>work item exists and belongs to the project → {@link
 *       WorkItemNotFoundException} (404); a cross-project item is the same 404</li>
 *   <li>caller holds {@link Permission#WORKITEM_EDIT} → {@link
 *       AccessDeniedException} (403)</li>
 * </ol>
 *
 * <p>There is no parent check: a subtask is an allowed source.
 */
@Service
public class AiStoryImprovementService {

    private final ProjectAccessGuard accessGuard;
    private final AiPlanningService aiPlanningService;

    public AiStoryImprovementService(ProjectAccessGuard accessGuard, AiPlanningService aiPlanningService) {
        this.accessGuard = accessGuard;
        this.aiPlanningService = aiPlanningService;
    }

    /**
     * @param projectId project the draft is scoped to; must exist
     * @param request the target work item id, already bean-validated as non-null
     * @param requesterId the authenticated caller
     * @return a non-persisted improved-story draft
     * @throws ProjectNotFoundException if {@code projectId} is unknown
     * @throws WorkItemNotFoundException if {@code workItemId} is unknown or not in {@code projectId}
     * @throws AccessDeniedException if the caller lacks {@link Permission#WORKITEM_EDIT}
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     */
    public GeneratedUserStoryResponse generate(
            Long projectId, GenerateAcceptanceCriteriaRequest request, Long requesterId) {
        accessGuard.requireProjectExists(projectId);

        WorkItem story = accessGuard.requireWorkItemInProject(request.workItemId(), projectId);

        accessGuard.requirePermission(requesterId, projectId, Permission.WORKITEM_EDIT);

        return aiPlanningService.generateStoryImprovement(AiStoryContext.compose(story));
    }
}
