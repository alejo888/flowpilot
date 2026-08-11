package com.flowpilot.exception;

/**
 * Thrown when an operation (deactivation or role change) would leave zero
 * active {@code GlobalRole.ADMINISTRADOR} users. Maps to HTTP 409.
 */
public class LastAdministratorException extends RuntimeException {

    public LastAdministratorException() {
        super("Cannot deactivate or demote the last active Administrador");
    }
}
