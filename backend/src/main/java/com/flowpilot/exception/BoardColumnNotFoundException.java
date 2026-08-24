package com.flowpilot.exception;

public class BoardColumnNotFoundException extends RuntimeException {

    public BoardColumnNotFoundException(Long id) {
        super("Columna del tablero no encontrada: " + id);
    }

    private BoardColumnNotFoundException(String message) {
        super(message);
    }

    /**
     * The project exists but has zero board columns (shouldn't normally
     * happen since projects seed default columns on create, but the code
     * path exists) — distinct from {@link #BoardColumnNotFoundException(Long)}
     * so the message doesn't misleadingly claim the project itself is
     * missing (was previously surfaced as {@code ProjectNotFoundException}).
     */
    public static BoardColumnNotFoundException forProject(Long projectId) {
        return new BoardColumnNotFoundException(
                "El proyecto " + projectId + " no tiene columnas de tablero configuradas");
    }
}
