package com.flowpilot.exception;

public class BoardColumnNotFoundException extends RuntimeException {

    public BoardColumnNotFoundException(Long id) {
        super("Board column not found: " + id);
    }
}
