package com.flowpilot.controller;

import com.flowpilot.dto.RolePermissionMatrixResponse;
import com.flowpilot.dto.RolePermissionUpdateRequest;
import com.flowpilot.service.RolePermissionAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only permission-matrix endpoints (spec: role-permissions).
 * Authorization is a GLOBAL role check inside {@link
 * RolePermissionAdminService} (caller must have {@code
 * GlobalRole.ADMINISTRADOR}), same pattern as {@link AdminUserController} —
 * deliberately unrelated to {@link com.flowpilot.service.ProjectAuthorizationService}.
 *
 * <p>Slice 8a shipped {@code GET}; slice 8b adds the bulk {@code PUT}
 * (atomic replace, 409 on stale {@code expectedUpdatedAt}, cache reload).
 */
@RestController
@RequestMapping("/api/admin/role-permissions")
public class RolePermissionAdminController {

    private final RolePermissionAdminService rolePermissionAdminService;

    public RolePermissionAdminController(RolePermissionAdminService rolePermissionAdminService) {
        this.rolePermissionAdminService = rolePermissionAdminService;
    }

    @Operation(summary = "Get the full 6x11 role/permission matrix — admin-only")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Matrix"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not a global Administrador",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping
    public RolePermissionMatrixResponse getMatrix(Authentication authentication) {
        return rolePermissionAdminService.getMatrix(currentUserId(authentication));
    }

    @Operation(summary = "Bulk atomic replace of every grant in the matrix — admin-only")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Matrix replaced"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not a global Administrador",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(
                responseCode = "409",
                description = "expectedUpdatedAt is stale — matrix changed since it was loaded",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PutMapping
    public RolePermissionMatrixResponse replaceAll(
            @Valid @RequestBody RolePermissionUpdateRequest request, Authentication authentication) {
        return rolePermissionAdminService.replaceAll(currentUserId(authentication), request);
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
