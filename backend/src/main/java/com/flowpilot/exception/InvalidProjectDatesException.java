package com.flowpilot.exception;

/**
 * Thrown when a project's {@code startDate} is after its {@code
 * estimatedEndDate} (spec: project-management delta "Optional Planned Start
 * and Estimated End Dates"; design A2). Mapped to 400 Bad Request.
 */
public class InvalidProjectDatesException extends RuntimeException {

    public InvalidProjectDatesException() {
        super("Start date must not be after the estimated end date");
    }
}
