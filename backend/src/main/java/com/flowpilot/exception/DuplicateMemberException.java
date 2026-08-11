package com.flowpilot.exception;

public class DuplicateMemberException extends RuntimeException {

    public DuplicateMemberException(Long projectId, Long userId) {
        super("User " + userId + " is already a member of project " + projectId);
    }
}
