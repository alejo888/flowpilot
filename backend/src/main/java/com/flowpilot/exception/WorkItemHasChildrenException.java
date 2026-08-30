package com.flowpilot.exception;

/**
 * Raised when a work item that still has direct subtasks is deleted (spec:
 * work-item-hierarchy). Maps to 409 in {@link GlobalExceptionHandler}. The
 * Spanish RFC 7807 detail names the exact child count, with singular/plural
 * wording ({@code 1 subtarea} vs {@code N subtareas}).
 */
public class WorkItemHasChildrenException extends RuntimeException {

    private final long childCount;

    public WorkItemHasChildrenException(long childCount) {
        super("No se puede eliminar: la tarea tiene " + childCount
                + (childCount == 1 ? " subtarea." : " subtareas."));
        this.childCount = childCount;
    }

    public long getChildCount() {
        return childCount;
    }
}
