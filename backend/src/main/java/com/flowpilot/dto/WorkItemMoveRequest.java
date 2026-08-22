package com.flowpilot.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Move payload for {@code PUT /api/work-items/{id}/move} (spec: kanban-board,
 * "WorkItem move" requirement). {@code position} is the desired zero-based
 * insertion index of the item WITHIN the target column's existing items
 * (the moved item itself excluded) — not a raw gap-based position value.
 * {@link com.flowpilot.service.BoardService} translates that index into a
 * gap-based {@code WorkItem.position} (design D10).
 */
public record WorkItemMoveRequest(
        @NotNull(message = "La columna no puede estar vacía") Long columnId,
        @NotNull(message = "La posición no puede estar vacía")
        @Min(value = 0, message = "La posición no puede ser negativa") Integer position) {
}
