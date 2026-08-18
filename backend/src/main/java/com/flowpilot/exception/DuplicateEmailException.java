package com.flowpilot.exception;

/**
 * Thrown when registration is attempted with an email already in use. Maps to HTTP 409.
 *
 * <p>The message never echoes the submitted address: the detail is relayed verbatim
 * to the client, and interpolating the email there would turn the 409 into an
 * account-enumeration oracle — the same reason {@code handleBadCredentials} and
 * {@code PasswordResetService.forgotPassword} stay deliberately generic.
 */
public class DuplicateEmailException extends RuntimeException {

    public DuplicateEmailException() {
        super("El email ya está registrado");
    }
}
