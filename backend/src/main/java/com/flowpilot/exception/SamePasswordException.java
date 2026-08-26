package com.flowpilot.exception;

/**
 * Thrown when a change-password request's {@code newPassword} equals its
 * {@code currentPassword} — a no-op "change" that would still re-hash and
 * revoke every active refresh token for nothing. Maps to HTTP 400.
 */
public class SamePasswordException extends RuntimeException {

    public SamePasswordException(String message) {
        super(message);
    }
}
