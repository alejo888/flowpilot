package com.flowpilot.exception;

/** Thrown when registration is attempted with an email already in use. Maps to HTTP 409. */
public class DuplicateEmailException extends RuntimeException {

    public DuplicateEmailException(String email) {
        super("Email already registered: " + email);
    }
}
