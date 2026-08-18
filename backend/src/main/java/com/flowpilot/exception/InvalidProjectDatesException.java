package com.flowpilot.exception;

/**
 * Thrown when a project's {@code startDate} is after its {@code
 * estimatedEndDate} (spec: project-management delta "Optional Planned Start
 * and Estimated End Dates"; design A2). Mapped to 400 Bad Request.
 */
public class InvalidProjectDatesException extends RuntimeException {

    public InvalidProjectDatesException() {
        super("La fecha de inicio no puede ser posterior a la fecha estimada de finalización");
    }
}
