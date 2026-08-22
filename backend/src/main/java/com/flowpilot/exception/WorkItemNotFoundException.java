package com.flowpilot.exception;

public class WorkItemNotFoundException extends RuntimeException {

    public WorkItemNotFoundException(Long id) {
        super("Elemento de trabajo no encontrado: " + id);
    }
}
