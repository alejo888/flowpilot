package com.flowpilot.exception;

public class ProjectMemberNotFoundException extends RuntimeException {

    public ProjectMemberNotFoundException(Long projectId, Long userId) {
        super("Miembro de proyecto no encontrado: proyecto=" + projectId + ", usuario=" + userId);
    }
}
