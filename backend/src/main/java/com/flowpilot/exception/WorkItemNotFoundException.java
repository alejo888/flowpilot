package com.flowpilot.exception;

public class WorkItemNotFoundException extends RuntimeException {

    public WorkItemNotFoundException(Long id) {
        super("Work item not found: " + id);
    }
}
