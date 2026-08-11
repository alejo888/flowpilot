package com.flowpilot.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.dto.RolePermissionCatalogEntry;
import com.flowpilot.dto.RolePermissionGrant;
import com.flowpilot.dto.RolePermissionMatrixResponse;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.exception.RolePermissionConcurrencyException;
import com.flowpilot.service.RolePermissionAdminService;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * spec: role-permissions, "Get matrix" / "Non-admin matrix access" / "Bulk
 * update success" / "Concurrent conflicting edit" scenarios.
 */
@ExtendWith(MockitoExtension.class)
class RolePermissionAdminControllerTest {

    @Mock
    private RolePermissionAdminService rolePermissionAdminService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        RolePermissionAdminController controller = new RolePermissionAdminController(rolePermissionAdminService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void adminGetsFullMatrixReturns200() throws Exception {
        OffsetDateTime updatedAt = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        RolePermissionMatrixResponse response = new RolePermissionMatrixResponse(
                List.of(ProjectRole.values()),
                List.of(new RolePermissionCatalogEntry(
                        Permission.MEMBER_ADD, "Agregar miembros", "Añadir un nuevo miembro al proyecto")),
                List.of(new RolePermissionGrant(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)),
                updatedAt);
        when(rolePermissionAdminService.getMatrix(eq(1L))).thenReturn(response);

        mockMvc.perform(get("/api/admin/role-permissions").principal(authenticatedAs(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles.length()").value(ProjectRole.values().length))
                .andExpect(jsonPath("$.grants[0].role").value("PROJECT_MANAGER"))
                .andExpect(jsonPath("$.grants[0].permission").value("MEMBER_ADD"))
                .andExpect(jsonPath("$.grants[0].granted").value(true))
                .andExpect(jsonPath("$.updatedAt").exists());
    }

    @Test
    void nonAdminGetsMatrixReturns403() throws Exception {
        when(rolePermissionAdminService.getMatrix(eq(2L)))
                .thenThrow(new AccessDeniedException("Administrator role required"));

        mockMvc.perform(get("/api/admin/role-permissions").principal(authenticatedAs(2L)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminBulkReplaceReturns200WithUpdatedMatrix() throws Exception {
        OffsetDateTime newUpdatedAt = OffsetDateTime.parse("2026-01-02T00:00:00Z");
        RolePermissionMatrixResponse response = new RolePermissionMatrixResponse(
                List.of(ProjectRole.values()),
                List.of(new RolePermissionCatalogEntry(
                        Permission.MEMBER_ADD, "Agregar miembros", "Añadir un nuevo miembro al proyecto")),
                List.of(new RolePermissionGrant(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)),
                newUpdatedAt);
        when(rolePermissionAdminService.replaceAll(eq(1L), any())).thenReturn(response);

        mockMvc.perform(put("/api/admin/role-permissions")
                        .principal(authenticatedAs(1L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulkReplaceJson("PROJECT_MANAGER", "MEMBER_ADD", true, "2026-01-01T00:00:00Z")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grants[0].granted").value(true))
                .andExpect(jsonPath("$.updatedAt").exists());
    }

    @Test
    void staleExpectedUpdatedAtReturns409() throws Exception {
        when(rolePermissionAdminService.replaceAll(eq(1L), any()))
                .thenThrow(new RolePermissionConcurrencyException());

        mockMvc.perform(put("/api/admin/role-permissions")
                        .principal(authenticatedAs(1L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulkReplaceJson("PROJECT_MANAGER", "MEMBER_ADD", true, "2020-01-01T00:00:00Z")))
                .andExpect(status().isConflict());
    }

    @Test
    void nonAdminBulkReplaceReturns403() throws Exception {
        when(rolePermissionAdminService.replaceAll(eq(2L), any()))
                .thenThrow(new AccessDeniedException("Administrator role required"));

        mockMvc.perform(put("/api/admin/role-permissions")
                        .principal(authenticatedAs(2L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulkReplaceJson("PROJECT_MANAGER", "MEMBER_ADD", true, "2026-01-01T00:00:00Z")))
                .andExpect(status().isForbidden());
    }

    /**
     * Hand-built JSON avoids needing a java.time module registered on the
     * test-scope classic {@code com.fasterxml.jackson} ObjectMapper (present
     * here only transitively via {@code jjwt-jackson}); the real controller
     * runs on Spring Boot 4's Jackson 3 message converter, which handles
     * {@link OffsetDateTime} natively.
     */
    private static String bulkReplaceJson(String role, String permission, boolean granted, String expectedUpdatedAt) {
        return "{\"grants\":[{\"role\":\"" + role + "\",\"permission\":\"" + permission
                + "\",\"granted\":" + granted + "}],\"expectedUpdatedAt\":\"" + expectedUpdatedAt + "\"}";
    }

    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
