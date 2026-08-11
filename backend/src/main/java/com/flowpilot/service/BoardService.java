package com.flowpilot.service;

import com.flowpilot.dto.WorkItemMoveRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.BoardColumnNotFoundException;
import com.flowpilot.exception.CrossProjectColumnException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WorkItem move (spec: kanban-board, "WorkItem move" requirement; design
 * D10). Validates the target {@link BoardColumn} belongs to the SAME project
 * as the {@link WorkItem} (rejecting cross-project moves), then computes a
 * gap-based position (1024 step) for the requested insertion index within
 * the target column. A normal move is a single UPDATE; the target column is
 * fully re-sequenced only when the computed gap would be {@code < 2}.
 * Authorization reuses {@link ProjectAuthorizationService#canManageWorkItems}
 * — the same gate as other WorkItem writes (any project member, not
 * owner/admin-only).
 */
@Service
public class BoardService {

    private static final int POSITION_STEP = 1024;
    private static final int MIN_GAP = 2;

    private final WorkItemRepository workItemRepository;
    private final BoardColumnRepository boardColumnRepository;
    private final ProjectAuthorizationService authorizationService;

    public BoardService(
            WorkItemRepository workItemRepository,
            BoardColumnRepository boardColumnRepository,
            ProjectAuthorizationService authorizationService) {
        this.workItemRepository = workItemRepository;
        this.boardColumnRepository = boardColumnRepository;
        this.authorizationService = authorizationService;
    }

    @Transactional
    public WorkItemResponse move(Long itemId, WorkItemMoveRequest request, Long requesterId) {
        WorkItem item = workItemRepository.findById(itemId)
                .orElseThrow(() -> new WorkItemNotFoundException(itemId));

        if (!authorizationService.canManageWorkItems(requesterId, item.getProjectId())) {
            throw new AccessDeniedException("Not authorized to move this work item");
        }

        BoardColumn targetColumn = boardColumnRepository.findById(request.columnId())
                .orElseThrow(() -> new BoardColumnNotFoundException(request.columnId()));

        if (!targetColumn.getProjectId().equals(item.getProjectId())) {
            throw new CrossProjectColumnException(request.columnId(), item.getProjectId());
        }

        List<WorkItem> siblings = workItemRepository.findByColumnIdOrderByPositionAsc(targetColumn.getId()).stream()
                .filter(sibling -> !sibling.getId().equals(item.getId()))
                .toList();

        int index = Math.max(0, Math.min(request.position(), siblings.size()));
        Integer beforePosition = index > 0 ? siblings.get(index - 1).getPosition() : null;
        Integer afterPosition = index < siblings.size() ? siblings.get(index).getPosition() : null;

        int newPosition;
        if (needsResequence(beforePosition, afterPosition)) {
            newPosition = resequence(siblings, index);
        } else {
            newPosition = computeCandidate(beforePosition, afterPosition);
        }

        item.moveTo(targetColumn.getId(), newPosition);
        return toResponse(item);
    }

    private int computeCandidate(Integer beforePosition, Integer afterPosition) {
        if (beforePosition == null && afterPosition == null) {
            return POSITION_STEP;
        }
        if (beforePosition == null) {
            return afterPosition / 2;
        }
        if (afterPosition == null) {
            return beforePosition + POSITION_STEP;
        }
        return beforePosition + (afterPosition - beforePosition) / 2;
    }

    private boolean needsResequence(Integer beforePosition, Integer afterPosition) {
        int candidate = computeCandidate(beforePosition, afterPosition);
        if (candidate < 1) {
            return true;
        }
        if (beforePosition != null && candidate <= beforePosition) {
            return true;
        }
        return afterPosition != null && candidate >= afterPosition;
    }

    /**
     * Re-sequences every sibling in the target column at {@code POSITION_STEP}
     * intervals, reserving a slot for the moved item at {@code index}.
     * Returns the position assigned to the moved item.
     */
    private int resequence(List<WorkItem> siblings, int index) {
        int position = POSITION_STEP;
        int newPosition = POSITION_STEP;
        int cursor = 0;
        for (WorkItem sibling : siblings) {
            if (cursor == index) {
                newPosition = position;
                position += POSITION_STEP;
            }
            sibling.setPosition(position);
            position += POSITION_STEP;
            cursor++;
        }
        if (cursor == index) {
            newPosition = position;
        }
        return newPosition;
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
