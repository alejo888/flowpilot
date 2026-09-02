package com.flowpilot.service;

import com.flowpilot.dto.GenerateAcceptanceCriteriaRequest;
import com.flowpilot.dto.GeneratedAcceptanceCriteriaResponse;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.WorkItemRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/**
 * Application-layer entry point for AI acceptance-criteria generation (spec:
 * ai-acceptance-criteria-generation — PR 1). Third instance of the {@link
 * AiUserStoryService} / {@link AiSubtaskService} pattern: authorization lives
 * here, never in the controller, and nothing is persisted.
 *
 * <p><strong>Guard divergence:</strong> unlike its two siblings this service
 * checks {@link Permission#WORKITEM_EDIT}, not {@link
 * Permission#WORKITEM_CREATE} (design D3). The caller attaches the generated
 * criteria to an <em>existing</em> work item through {@code PUT
 * /api/work-items/{id}} → {@link WorkItemService#update}, which is {@code
 * WORKITEM_EDIT}-guarded; gating generation on {@code WORKITEM_CREATE} would
 * let a caller produce criteria they cannot save.
 *
 * <p>Check order (design D9), 404 strictly before 403 so the endpoint never
 * confirms a work item's existence in a project the caller did not name:
 * <ol>
 *   <li>project exists → {@link ProjectNotFoundException} (404)</li>
 *   <li>work item exists and belongs to the project → {@link
 *       WorkItemNotFoundException} (404); a cross-project item is the same 404,
 *       not a 400</li>
 *   <li>caller holds {@link Permission#WORKITEM_EDIT} → {@link
 *       AccessDeniedException} (403)</li>
 * </ol>
 *
 * <p>There is no parent check (design D8): a work item that is itself a
 * subtask is an allowed source — acceptance criteria are a plain list field
 * valid on any work item.
 */
@Service
public class AiAcceptanceCriteriaService {

    private final ProjectRepository projectRepository;
    private final WorkItemRepository workItemRepository;
    private final ProjectAuthorizationService authorizationService;
    private final AiPlanningService aiPlanningService;

    public AiAcceptanceCriteriaService(
            ProjectRepository projectRepository,
            WorkItemRepository workItemRepository,
            ProjectAuthorizationService authorizationService,
            AiPlanningService aiPlanningService) {
        this.projectRepository = projectRepository;
        this.workItemRepository = workItemRepository;
        this.authorizationService = authorizationService;
        this.aiPlanningService = aiPlanningService;
    }

    /**
     * @param projectId project the draft is scoped to; must exist
     * @param request the target work item id, already bean-validated as non-null
     * @param requesterId the authenticated caller
     * @return a non-persisted draft list of 1..8 acceptance criteria
     * @throws ProjectNotFoundException if {@code projectId} is unknown
     * @throws WorkItemNotFoundException if {@code workItemId} is unknown or not in {@code projectId}
     * @throws AccessDeniedException if the caller lacks {@link Permission#WORKITEM_EDIT}
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     */
    public GeneratedAcceptanceCriteriaResponse generate(
            Long projectId, GenerateAcceptanceCriteriaRequest request, Long requesterId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ProjectNotFoundException(projectId);
        }

        WorkItem story = workItemRepository
                .findById(request.workItemId())
                .filter(item -> item.getProjectId().equals(projectId))
                .orElseThrow(() -> new WorkItemNotFoundException(request.workItemId()));

        if (!authorizationService.hasPermission(requesterId, projectId, Permission.WORKITEM_EDIT)) {
            throw new AccessDeniedException(
                    "Falta el permiso " + Permission.WORKITEM_EDIT + " en el proyecto " + projectId);
        }

        return aiPlanningService.generateAcceptanceCriteria(AiStoryContext.compose(story));
    }
}
