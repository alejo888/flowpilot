package com.flowpilot.exception;

/** Thrown when a change-password request's current password does not match the stored hash. Maps to HTTP 400. */
public class InvalidCurrentPasswordException extends RuntimeException {

    public InvalidCurrentPasswordException(String message) {
        super(message);
    }
}
