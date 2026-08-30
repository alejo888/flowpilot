package com.flowpilot.service;

import com.flowpilot.dto.WorkItemCreateRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.dto.WorkItemUpdateRequest;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.SprintStatus;
import com.flowpilot.entity.User;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.BoardColumnNotFoundException;
import com.flowpilot.exception.InvalidSprintException;
import com.flowpilot.exception.ProjectMemberNotFoundException;
import com.flowpilot.exception.SprintNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.SprintRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WorkItem CRUD (spec: work-items). Writes funnel through {@link
 * ProjectAuthorizationService#hasPermission}: {@code create} requires
 * {@link Permission#WORKITEM_CREATE}, {@code update} requires {@link
 * Permission#WORKITEM_EDIT}, {@code delete} requires {@link
 * Permission#WORKITEM_DELETE} (proposal's Permission Catalog table; slice
 * 8a, matrix-backed, confirmed decision 5b) — every seeded role grants at
 * least create/edit by default, so task management stays usable by the whole
 * team out of the box; reads use {@link
 * ProjectAuthorizationService#canView} (owner/admin/member rule, unaffected
 * by the matrix). Creation always targets the project's first (lowest-position)
 * {@link BoardColumn} and appends to the end of that column using the gap-based
 * strategy shared with {@code BoardColumn.position} (design D10): {@code
 * max(position) + 1024}, or {@code 1024} if the column is empty. Moving an item
 * between columns is slice 6 ({@code PUT /api/work-items/{id}/move}) — this
 * service never mutates {@code columnId}/{@code position} after creation.
 */
@Service
public class WorkItemService {

    private static final int POSITION_STEP = 1024;

    private final WorkItemRepository workItemRepository;
    private final BoardColumnRepository boardColumnRepository;
    private final UserRepository userRepository;
    private final ProjectAuthorizationService authorizationService;
    private ProjectActivityService activityService;
    private final SprintRepository sprintRepository;

    public WorkItemService(
            WorkItemRepository workItemRepository,
            BoardColumnRepository boardColumnRepository,
            UserRepository userRepository,
            ProjectAuthorizationService authorizationService,
            SprintRepository sprintRepository) {
        this.workItemRepository = workItemRepository;
        this.boardColumnRepository = boardColumnRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
        this.sprintRepository = sprintRepository;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setActivityService(ProjectActivityService service) { this.activityService = service; }

    @Transactional
    public WorkItemResponse create(Long projectId, WorkItemCreateRequest request, Long requesterId) {
        requirePermission(requesterId, projectId, Permission.WORKITEM_CREATE);
        BoardColumn firstColumn = boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(projectId)
                .orElseThrow(() -> BoardColumnNotFoundException.forProject(projectId));
        int position = nextPosition(firstColumn.getId());
        WorkItem item = new WorkItem(
                projectId, firstColumn.getId(), request.title(), request.description(),
                request.assignedUserId(), position, request.sprintId(), request.priority());
        item.setAcceptanceCriteria(request.acceptanceCriteria());
        item.setAiGenerated(Boolean.TRUE.equals(request.aiGenerated()));
        item.setAiModel(request.aiModel());
        validateSprint(projectId, item.getSprintId());
        validateAssignee(projectId, item.getAssignedUserId());
        item = workItemRepository.save(item);
            if (activityService != null) activityService.record(projectId, requesterId, ActivityEventType.WORK_ITEM_CREATED, "Se creó la tarea \"" + item.getTitle() + "\"", "{}");
        return toResponse(item, resolveAssignedUserName(item.getAssignedUserId()));
    }

    public WorkItemResponse findById(Long id, Long requesterId) {
        WorkItem item = getOrThrow(id);
        requireCanView(requesterId, item.getProjectId());
        return toResponse(item, resolveAssignedUserName(item.getAssignedUserId()));
    }

    public List<WorkItemResponse> list(Long projectId, Long requesterId) {
        requireCanView(requesterId, projectId);
        List<WorkItem> items = workItemRepository.findByProjectIdOrderByColumnIdAscPositionAsc(projectId);
        Map<Long, String> assignedUserNames = assignedUserNamesFor(items);
        return items.stream()
                .map(item -> toResponse(item, assignedUserNames.get(item.getAssignedUserId())))
                .toList();
    }

    @Transactional
    public WorkItemResponse update(Long id, WorkItemUpdateRequest request, Long requesterId) {
        WorkItem item = getOrThrow(id);
        requirePermission(requesterId, item.getProjectId(), Permission.WORKITEM_EDIT);
        item.setTitle(request.title());
        item.setDescription(request.description());
        item.setAcceptanceCriteria(request.acceptanceCriteria());
        validateAssignee(item.getProjectId(), request.assignedUserId());
        item.setAssignedUserId(request.assignedUserId());
        validateSprint(item.getProjectId(), request.sprintId());
        item.setSprintId(request.sprintId());
        if (request.priority() != null) {
            item.setPriority(request.priority());
        }
        item.touch();
            if (activityService != null) activityService.record(item.getProjectId(), requesterId, ActivityEventType.WORK_ITEM_UPDATED, "Se actualizó la tarea \"" + item.getTitle() + "\"", "{}");
        return toResponse(item, resolveAssignedUserName(item.getAssignedUserId()));
    }

    @Transactional
    public void delete(Long id, Long requesterId) {
        WorkItem item = getOrThrow(id);
        requirePermission(requesterId, item.getProjectId(), Permission.WORKITEM_DELETE);
        workItemRepository.delete(item);
            if (activityService != null) activityService.record(item.getProjectId(), requesterId, ActivityEventType.WORK_ITEM_DELETED, "Se eliminó la tarea \"" + item.getTitle() + "\"", "{}");
    }

    /**
     * No-op on {@code null}. Otherwise confirms the sprint belongs to the
     * project and rejects assignment into a {@code COMPLETED} sprint: a
     * completed sprint's own lifecycle is frozen against edits ({@link
     * SprintService#update}), but a work item could still be moved into or
     * out of it through this endpoint, retroactively mutating closed-sprint
     * history that dashboard metrics depend on. PLANNED and ACTIVE sprints
     * remain assignable — the normal sprint-planning workflow.
     */
    private void validateSprint(Long projectId, Long sprintId) {
        if (sprintId == null) {
            return;
        }
        Sprint sprint = sprintRepository.findByIdAndProjectId(sprintId, projectId)
                .orElseThrow(() -> new SprintNotFoundException(sprintId));
        if (sprint.getStatus() == SprintStatus.COMPLETED) {
            throw new InvalidSprintException("No se puede asignar un elemento a un sprint completado");
        }
    }

    /**
     * Mirrors {@link #validateSprint}: no-op on {@code null}, otherwise
     * confirms the assignee exists AND is a participant of the project
     * (owner, global admin, or a live {@link com.flowpilot.entity.ProjectMember}
     * — reusing {@link ProjectAuthorizationService#canView}'s exact membership
     * formula rather than a raw {@code ProjectMemberRepository} check, so the
     * project owner/an admin can be assigned even without an explicit
     * membership row). {@code canView} itself throws {@link
     * com.flowpilot.exception.UserNotFoundException} when the assignee id
     * doesn't exist, closing the previous gap where a bogus id fell through
     * to a misleading 409 FK-violation instead of a proper 404/400.
     */
    private void validateAssignee(Long projectId, Long assignedUserId) {
        if (assignedUserId == null) {
            return;
        }
        if (!authorizationService.canView(assignedUserId, projectId)) {
            throw new ProjectMemberNotFoundException(projectId, assignedUserId);
        }
    }

    private int nextPosition(Long columnId) {
        return workItemRepository.findFirstByColumnIdOrderByPositionDesc(columnId)
                .map(existing -> existing.getPosition() + POSITION_STEP)
                .orElse(POSITION_STEP);
    }

    private void requirePermission(Long requesterId, Long projectId, Permission permission) {
        if (!authorizationService.hasPermission(requesterId, projectId, permission)) {
            throw new AccessDeniedException("Falta el permiso " + permission + " en el proyecto " + projectId);
        }
    }

    private void requireCanView(Long requesterId, Long projectId) {
        if (!authorizationService.canView(requesterId, projectId)) {
            throw new AccessDeniedException("No autorizado para ver los elementos de trabajo de este proyecto");
        }
    }

    private WorkItem getOrThrow(Long id) {
        return workItemRepository.findById(id)
                .orElseThrow(() -> new WorkItemNotFoundException(id));
    }

    private String resolveAssignedUserName(Long assignedUserId) {
        if (assignedUserId == null) {
            return null;
        }
        return userRepository.findById(assignedUserId).map(User::getName).orElse(null);
    }

    private Map<Long, String> assignedUserNamesFor(List<WorkItem> items) {
        List<Long> assignedUserIds = items.stream()
                .map(WorkItem::getAssignedUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        return userRepository.findAllById(assignedUserIds).stream()
                .collect(Collectors.toMap(User::getId, User::getName));
    }

    static WorkItemResponse toResponse(WorkItem item, String assignedUserName) {
        return new WorkItemResponse(
                item.getId(),
                item.getProjectId(),
                item.getColumnId(),
                item.getTitle(),
                item.getDescription(),
                item.getAssignedUserId(),
                assignedUserName,
                item.getPosition(),
                item.getCreatedAt(),
                item.getUpdatedAt(),
                item.getSprintId(),
                item.getPriority(),
                item.getAcceptanceCriteria(),
                item.isAiGenerated(),
                item.getAiModel());
    }
}
