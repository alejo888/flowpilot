package com.flowpilot.exception;

/** Thrown when a password reset token is unknown, expired, or already used. Maps to HTTP 400. */
public class InvalidResetTokenException extends RuntimeException {

    public InvalidResetTokenException(String message) {
        super(message);
    }
}
