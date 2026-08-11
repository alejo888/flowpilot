package com.flowpilot.dto;

import com.flowpilot.entity.GlobalRole;

/**
 * Full admin-facing user projection (spec: user-administration). Unlike
 * {@link UserSummaryResponse} this exposes {@code role} and {@code active}
 * since admins need them to manage the platform.
 */
public record UserAdminResponse(Long id, String name, String email, GlobalRole role, boolean active) {
}
