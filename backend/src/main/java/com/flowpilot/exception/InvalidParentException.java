package com.flowpilot.exception;

/**
 * A parent-link request (create or update) broke a one-level-hierarchy rule
 * (spec: work-item-hierarchy): self-reference, cross-project parent, a parent
 * that is itself a subtask, or an item that already has children. Maps to 400
 * in {@link GlobalExceptionHandler}, mirroring {@link InvalidSprintException}.
 */
public class InvalidParentException extends RuntimeException {

    public InvalidParentException(String message) {
        super(message);
    }
}
