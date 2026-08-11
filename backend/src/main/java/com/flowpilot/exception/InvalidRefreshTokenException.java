package com.flowpilot.exception;

/**
 * Thrown when a refresh token is missing, unknown, expired, revoked, reused,
 * or belongs to a deactivated user. Maps to HTTP 401.
 */
public class InvalidRefreshTokenException extends RuntimeException {

    public InvalidRefreshTokenException(String message) {
        super(message);
    }
}
