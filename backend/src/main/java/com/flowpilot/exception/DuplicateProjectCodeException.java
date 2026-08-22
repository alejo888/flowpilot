package com.flowpilot.exception;

/**
 * Thrown when a project create/update targets a {@code code} that already
 * belongs to another project, compared case-insensitively (spec: project-management
 * delta "Optional Project Code"; design A1 — service pre-check ahead of the
 * partial unique index backstop). Mapped to 409 Conflict.
 */
public class DuplicateProjectCodeException extends RuntimeException {

    public DuplicateProjectCodeException(String code) {
        super("Ya existe un proyecto con el código '" + code + "'");
    }
}
