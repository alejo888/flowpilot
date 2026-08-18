package com.flowpilot.exception;

/**
 * Thrown when a WorkItem move targets a {@code BoardColumn} that belongs to a
 * different project than the item itself (spec: kanban-board, "Cross-project
 * column" scenario — rejected, no change). Mapped to 400 Bad Request.
 */
public class CrossProjectColumnException extends RuntimeException {

    public CrossProjectColumnException(Long columnId, Long itemProjectId) {
        super("La columna del tablero " + columnId + " no pertenece al proyecto " + itemProjectId);
    }
}
