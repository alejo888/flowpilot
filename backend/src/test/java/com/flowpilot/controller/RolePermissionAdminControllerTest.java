package com.flowpilot.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.dto.RolePermissionCatalogEntry;
import com.flowpilot.dto.RolePermissionGrant;
import com.flowpilot.dto.RolePermissionMatrixResponse;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.service.RolePermissionAdminService;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * spec: role-permissions, "Get matrix" / "Non-admin matrix access" scenarios.
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

    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
