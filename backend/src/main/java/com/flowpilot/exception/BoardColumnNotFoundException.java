package com.flowpilot.exception;

public class BoardColumnNotFoundException extends RuntimeException {

    public BoardColumnNotFoundException(Long id) {
        super("Columna del tablero no encontrada: " + id);
    }
}
