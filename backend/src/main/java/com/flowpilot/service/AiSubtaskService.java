package com.flowpilot.service;

import com.flowpilot.dto.GenerateSubtasksRequest;
import com.flowpilot.dto.GeneratedSubtasksResponse;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.InvalidParentException;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/**
 * Application-layer entry point for AI subtask generation (spec:
 * ai-subtask-generation — PR 1). Second instance of the {@link
 * AiUserStoryService} pattern: authorization lives here, never in the
 * controller, and nothing is persisted.
 *
 * <p>Check order (design D3), 404 strictly before 403 so the endpoint never
 * confirms an item's existence in a project the caller did not name:
 * <ol>
 *   <li>project exists → {@link ProjectNotFoundException} (404)</li>
 *   <li>mode (a) only: work item exists and belongs to the project → {@link
 *       WorkItemNotFoundException} (404); a cross-project item is the same 404,
 *       not a 400</li>
 *   <li>caller holds {@link Permission#WORKITEM_CREATE} → {@link
 *       AccessDeniedException} (403)</li>
 *   <li>mode (a) only: the source story is not itself a subtask → {@link
 *       InvalidParentException} (400), deliberately after authorization</li>
 * </ol>
 *
 * <p>The exactly-one-of-{@code workItemId}/{@code storyText} guard is bean
 * validation on {@link GenerateSubtasksRequest}, not this service.
 */
@Service
public class AiSubtaskService {

    private final ProjectRepository projectRepository;
    private final WorkItemRepository workItemRepository;
    private final ProjectAuthorizationService authorizationService;
    private final AiPlanningService aiPlanningService;

    public AiSubtaskService(
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
     * @param request exactly one of {@code workItemId} / {@code storyText}, already bean-validated
     * @param requesterId the authenticated caller
     * @return a non-persisted draft list of 1..10 subtasks
     * @throws ProjectNotFoundException if {@code projectId} is unknown
     * @throws WorkItemNotFoundException if {@code workItemId} is unknown or not in {@code projectId}
     * @throws AccessDeniedException if the caller lacks {@link Permission#WORKITEM_CREATE}
     * @throws InvalidParentException if the source story is itself a subtask
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     */
    public GeneratedSubtasksResponse generate(
            Long projectId, GenerateSubtasksRequest request, Long requesterId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ProjectNotFoundException(projectId);
        }

        WorkItem story = null;
        if (request.workItemId() != null) {
            story = workItemRepository
                    .findById(request.workItemId())
                    .filter(item -> item.getProjectId().equals(projectId))
                    .orElseThrow(() -> new WorkItemNotFoundException(request.workItemId()));
        }

        if (!authorizationService.hasPermission(requesterId, projectId, Permission.WORKITEM_CREATE)) {
            throw new AccessDeniedException(
                    "Falta el permiso " + Permission.WORKITEM_CREATE + " en el proyecto " + projectId);
        }

        String storyContext;
        if (story != null) {
            if (story.getParentWorkItemId() != null) {
                throw new InvalidParentException("No se pueden generar subtareas de una subtarea");
            }
            storyContext = composeStoryContext(story);
        } else {
            storyContext = request.storyText().strip();
        }

        return aiPlanningService.generateSubtasks(storyContext);
    }

    /**
     * Backend-side story-context composition (design D3), like {@link
     * AiPlanningService#composeText} — the provider never builds this. The
     * acceptance-criteria block is omitted entirely when the list is empty.
     */
    static String composeStoryContext(WorkItem item) {
        StringBuilder context = new StringBuilder();
        context.append("Título: ").append(item.getTitle()).append('\n');
        String description = item.getDescription();
        context.append("Descripción: ")
                .append(description == null || description.isBlank() ? "(sin descripción)" : description.strip());
        List<String> criteria = item.getAcceptanceCriteria();
        if (criteria != null && !criteria.isEmpty()) {
            context.append('\n').append("Criterios de aceptación:");
            for (String criterion : criteria) {
                context.append('\n').append("- ").append(criterion);
            }
        }
        return context.toString();
    }
}
