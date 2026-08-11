package com.flowpilot.exception;

public class ProjectMemberNotFoundException extends RuntimeException {

    public ProjectMemberNotFoundException(Long projectId, Long userId) {
        super("Project member not found: project=" + projectId + ", user=" + userId);
    }
}
