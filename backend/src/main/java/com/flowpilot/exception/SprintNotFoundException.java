package com.flowpilot.exception;

public class SprintNotFoundException extends RuntimeException {

    public SprintNotFoundException(Long id) {
        super("No existe el sprint " + id);
    }
}
