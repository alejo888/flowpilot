package com.flowpilot.exception;

public class DuplicateMemberException extends RuntimeException {

    public DuplicateMemberException(Long projectId, Long userId) {
        super("El usuario " + userId + " ya es miembro del proyecto " + projectId);
    }
}
