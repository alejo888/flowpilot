package com.flowpilot.exception;

public class CommentNotFoundException extends RuntimeException {

    public CommentNotFoundException(Long id) {
        super("Comentario no encontrado: " + id);
    }
}
