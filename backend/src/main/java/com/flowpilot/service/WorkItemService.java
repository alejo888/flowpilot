package com.flowpilot.service;

import com.flowpilot.dto.WorkItemCreateRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.dto.WorkItemUpdateRequest;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.User;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
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
 * least create/edit by default, so task management stays usable by the
 * whole team out of the box; reads use {@link
 * ProjectAuthorizationService#canView} (owner/admin/member rule, unaffected
 * by the matrix). Creation always
 * targets the project's first (lowest-position) {@link BoardColumn} and
 * appends to the end of that column using the gap-based strategy shared with
 * {@code BoardColumn.position} (design D10): {@code max(position) + 1024},
 * or {@code 1024} if the column is empty. Moving an item between columns is
 * slice 6 ({@code PUT /api/work-items/{id}/move}) — this service never
 * mutates {@code columnId}/{@code position} after creation.
 */
@Service
public class WorkItemService {

    private static final int POSITION_STEP = 1024;

    private final WorkItemRepository workItemRepository;
    private final BoardColumnRepository boardColumnRepository;
    private final UserRepository userRepository;
    private final ProjectAuthorizationService authorizationService;

    public WorkItemService(
            WorkItemRepository workItemRepository,
            BoardColumnRepository boardColumnRepository,
            UserRepository userRepository,
            ProjectAuthorizationService authorizationService) {
        this.workItemRepository = workItemRepository;
        this.boardColumnRepository = boardColumnRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
    }

    @Transactional
    public WorkItemResponse create(Long projectId, WorkItemCreateRequest request, Long requesterId) {
        requirePermission(requesterId, projectId, Permission.WORKITEM_CREATE);
        BoardColumn firstColumn = boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(projectId)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));
        int position = nextPosition(firstColumn.getId());
        WorkItem item = new WorkItem(
                projectId, firstColumn.getId(), request.title(), request.description(),
                request.assignedUserId(), position);
        item = workItemRepository.save(item);
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
        item.setAssignedUserId(request.assignedUserId());
        item.touch();
        return toResponse(item, resolveAssignedUserName(item.getAssignedUserId()));
    }

    @Transactional
    public void delete(Long id, Long requesterId) {
        WorkItem item = getOrThrow(id);
        requirePermission(requesterId, item.getProjectId(), Permission.WORKITEM_DELETE);
        workItemRepository.delete(item);
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
                item.getUpdatedAt());
    }
}
