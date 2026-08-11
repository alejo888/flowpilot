package com.flowpilot.exception;

/** Thrown when a lookup by id finds no matching user. Maps to HTTP 404. */
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(Long id) {
        super("User not found: " + id);
    }
}
