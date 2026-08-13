package com.flowpilot.controller;

import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.dto.UserRoleUpdateRequest;
import com.flowpilot.dto.UserStatusUpdateRequest;
import com.flowpilot.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only user management endpoints (spec: user-administration). Every
 * method is gated by a GLOBAL role check inside {@link AdminUserService}
 * (caller must have {@code GlobalRole.ADMINISTRADOR}) — a platform-wide
 * concern, deliberately unrelated to
 * {@link com.flowpilot.service.ProjectAuthorizationService}, which governs
 * project-scoped writes only. Authentication itself is enforced globally by
 * {@link com.flowpilot.security.SecurityConfig}'s {@code
 * anyRequest().authenticated()}.
 */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @Operation(summary = "List all users with full admin projection (role, active) — admin-only")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Users"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not a global Administrador",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping
    public List<UserAdminResponse> listUsers(Authentication authentication) {
        return adminUserService.listUsers(currentUserId(authentication));
    }

    @Operation(summary = "Activate or deactivate a user — admin-only")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Status updated"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not a global Administrador",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No user with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Would leave zero active Administradores",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PatchMapping("/{id}/status")
    public UserAdminResponse setStatus(
            @PathVariable Long id,
            @Valid @RequestBody UserStatusUpdateRequest request,
            Authentication authentication) {
        return adminUserService.setStatus(currentUserId(authentication), id, request.active());
    }

    @Operation(summary = "Change a user's global role — admin-only")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Role updated"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not a global Administrador",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No user with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Would leave zero active Administradores",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PutMapping("/{id}/role")
    public UserAdminResponse changeRole(
            @PathVariable Long id,
            @Valid @RequestBody UserRoleUpdateRequest request,
            Authentication authentication) {
        return adminUserService.changeRole(currentUserId(authentication), id, request.role());
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
