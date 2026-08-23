package com.flowpilot.exception;

/**
 * Raised when an unauthenticated auth endpoint exceeds its rate limit.
 * Mapped to {@code 429} by {@link GlobalExceptionHandler}.
 */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException() {
        super("Demasiados intentos. Intenta nuevamente en unos minutos");
    }
}
