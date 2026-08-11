package com.flowpilot.controller;

import com.flowpilot.dto.RolePermissionMatrixResponse;
import com.flowpilot.service.RolePermissionAdminService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only permission-matrix read endpoint (spec: role-permissions).
 * Authorization is a GLOBAL role check inside {@link
 * RolePermissionAdminService} (caller must have {@code
 * GlobalRole.ADMINISTRADOR}), same pattern as {@link AdminUserController} —
 * deliberately unrelated to {@link com.flowpilot.service.ProjectAuthorizationService}.
 *
 * <p>Slice 8a scope: {@code GET} only. The bulk {@code PUT} (admin edit, 409
 * on stale {@code expectedUpdatedAt}) is slice 8b's scope.
 */
@RestController
@RequestMapping("/api/admin/role-permissions")
public class RolePermissionAdminController {

    private final RolePermissionAdminService rolePermissionAdminService;

    public RolePermissionAdminController(RolePermissionAdminService rolePermissionAdminService) {
        this.rolePermissionAdminService = rolePermissionAdminService;
    }

    @GetMapping
    public RolePermissionMatrixResponse getMatrix(Authentication authentication) {
        return rolePermissionAdminService.getMatrix(currentUserId(authentication));
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
