package com.flowpilot.entity;

/**
 * Project lifecycle status (spec: project-management, "Project CRUD and
 * status lifecycle"). Enum names are the ASCII-safe form of the Spanish
 * lifecycle stages from the proposal doc section 6.2 (Planificación, Activo,
 * Pausado, Finalizado, Cancelado).
 */
public enum ProjectStatus {
    PLANIFICACION,
    ACTIVO,
    PAUSADO,
    FINALIZADO,
    CANCELADO
}
