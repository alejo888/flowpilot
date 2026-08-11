package com.flowpilot.service;

import com.flowpilot.dto.WorkItemCreateRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.dto.WorkItemUpdateRequest;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WorkItem CRUD (spec: work-items). Writes funnel through {@link
 * ProjectAuthorizationService#canManageWorkItems} — any project member
 * (owner, global admin, or a {@code ProjectMember}) may create/edit/delete
 * work items, since task management must stay usable by the whole team, not
 * just the project owner; reads use {@link ProjectAuthorizationService#canView}
 * (same owner/admin/member rule). {@code ProjectService}/{@code
 * ProjectMemberService} writes remain owner-or-admin-only and are
 * unaffected by this. Creation always
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
    private final ProjectAuthorizationService authorizationService;

    public WorkItemService(
            WorkItemRepository workItemRepository,
            BoardColumnRepository boardColumnRepository,
            ProjectAuthorizationService authorizationService) {
        this.workItemRepository = workItemRepository;
        this.boardColumnRepository = boardColumnRepository;
        this.authorizationService = authorizationService;
    }

    @Transactional
    public WorkItemResponse create(Long projectId, WorkItemCreateRequest request, Long requesterId) {
        requireCanManageWorkItems(requesterId, projectId);
        BoardColumn firstColumn = boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(projectId)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));
        int position = nextPosition(firstColumn.getId());
        WorkItem item = new WorkItem(
                projectId, firstColumn.getId(), request.title(), request.description(),
                request.assignedUserId(), position);
        item = workItemRepository.save(item);
        return toResponse(item);
    }

    public WorkItemResponse findById(Long id, Long requesterId) {
        WorkItem item = getOrThrow(id);
        requireCanView(requesterId, item.getProjectId());
        return toResponse(item);
    }

    public List<WorkItemResponse> list(Long projectId, Long requesterId) {
        requireCanView(requesterId, projectId);
        return workItemRepository.findByProjectIdOrderByColumnIdAscPositionAsc(projectId).stream()
                .map(WorkItemService::toResponse)
                .toList();
    }

    @Transactional
    public WorkItemResponse update(Long id, WorkItemUpdateRequest request, Long requesterId) {
        WorkItem item = getOrThrow(id);
        requireCanManageWorkItems(requesterId, item.getProjectId());
        item.setTitle(request.title());
        item.setDescription(request.description());
        item.setAssignedUserId(request.assignedUserId());
        item.touch();
        return toResponse(item);
    }

    @Transactional
    public void delete(Long id, Long requesterId) {
        WorkItem item = getOrThrow(id);
        requireCanManageWorkItems(requesterId, item.getProjectId());
        workItemRepository.delete(item);
    }

    private int nextPosition(Long columnId) {
        return workItemRepository.findFirstByColumnIdOrderByPositionDesc(columnId)
                .map(existing -> existing.getPosition() + POSITION_STEP)
                .orElse(POSITION_STEP);
    }

    private void requireCanManageWorkItems(Long requesterId, Long projectId) {
        if (!authorizationService.canManageWorkItems(requesterId, projectId)) {
            throw new AccessDeniedException("Not a member of this project");
        }
    }

    private void requireCanView(Long requesterId, Long projectId) {
        if (!authorizationService.canView(requesterId, projectId)) {
            throw new AccessDeniedException("Not authorized to view this project's work items");
        }
    }

    private WorkItem getOrThrow(Long id) {
        return workItemRepository.findById(id)
                .orElseThrow(() -> new WorkItemNotFoundException(id));
    }

    private static WorkItemResponse toResponse(WorkItem item) {
        return new WorkItemResponse(
                item.getId(),
                item.getProjectId(),
                item.getColumnId(),
                item.getTitle(),
                item.getDescription(),
                item.getAssignedUserId(),
                item.getPosition(),
                item.getCreatedAt(),
                item.getUpdatedAt());
    }
}
