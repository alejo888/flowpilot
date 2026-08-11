package com.flowpilot.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.dto.UserRoleUpdateRequest;
import com.flowpilot.dto.UserStatusUpdateRequest;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.exception.LastAdministratorException;
import com.flowpilot.service.AdminUserService;
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

@ExtendWith(MockitoExtension.class)
class AdminUserControllerTest {

    @Mock
    private AdminUserService adminUserService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        AdminUserController controller = new AdminUserController(adminUserService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listUsersReturns200WithFullAdminProjection() throws Exception {
        when(adminUserService.listUsers(1L)).thenReturn(List.of(
                new UserAdminResponse(1L, "Admin", "admin@flowpilot.local", GlobalRole.ADMINISTRADOR, true),
                new UserAdminResponse(2L, "Member", "member@flowpilot.local", GlobalRole.MIEMBRO_EQUIPO, true)));

        mockMvc.perform(get("/api/admin/users").principal(authenticatedAs(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].active").value(true))
                .andExpect(jsonPath("$[1].role").value("MIEMBRO_EQUIPO"));
    }

    @Test
    void listUsersByNonAdminReturns403() throws Exception {
        when(adminUserService.listUsers(2L)).thenThrow(new AccessDeniedException("Administrator role required"));

        mockMvc.perform(get("/api/admin/users").principal(authenticatedAs(2L)))
                .andExpect(status().isForbidden());
    }

    @Test
    void setStatusDeactivatesUserAndReturns200() throws Exception {
        when(adminUserService.setStatus(eq(1L), eq(2L), eq(false))).thenReturn(
                new UserAdminResponse(2L, "Member", "member@flowpilot.local", GlobalRole.MIEMBRO_EQUIPO, false));

        mockMvc.perform(patch("/api/admin/users/2/status")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UserStatusUpdateRequest(false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void setStatusRejectingLastAdminDeactivationReturns409() throws Exception {
        when(adminUserService.setStatus(eq(1L), eq(1L), eq(false)))
                .thenThrow(new LastAdministratorException());

        mockMvc.perform(patch("/api/admin/users/1/status")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UserStatusUpdateRequest(false))))
                .andExpect(status().isConflict());
    }

    @Test
    void setStatusByNonAdminReturns403() throws Exception {
        when(adminUserService.setStatus(eq(2L), eq(5L), eq(false)))
                .thenThrow(new AccessDeniedException("Administrator role required"));

        mockMvc.perform(patch("/api/admin/users/5/status")
                        .principal(authenticatedAs(2L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UserStatusUpdateRequest(false))))
                .andExpect(status().isForbidden());
    }

    @Test
    void changeRoleReturns200() throws Exception {
        when(adminUserService.changeRole(eq(1L), eq(2L), eq(GlobalRole.ADMINISTRADOR))).thenReturn(
                new UserAdminResponse(2L, "Member", "member@flowpilot.local", GlobalRole.ADMINISTRADOR, true));

        mockMvc.perform(put("/api/admin/users/2/role")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UserRoleUpdateRequest(GlobalRole.ADMINISTRADOR))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMINISTRADOR"));
    }

    @Test
    void changeRoleRejectingLastAdminDemotionReturns409() throws Exception {
        when(adminUserService.changeRole(eq(1L), eq(1L), eq(GlobalRole.MIEMBRO_EQUIPO)))
                .thenThrow(new LastAdministratorException());

        mockMvc.perform(put("/api/admin/users/1/role")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UserRoleUpdateRequest(GlobalRole.MIEMBRO_EQUIPO))))
                .andExpect(status().isConflict());
    }

    @Test
    void changeRoleByNonAdminReturns403() throws Exception {
        when(adminUserService.changeRole(eq(2L), eq(5L), eq(GlobalRole.ADMINISTRADOR)))
                .thenThrow(new AccessDeniedException("Administrator role required"));

        mockMvc.perform(put("/api/admin/users/5/role")
                        .principal(authenticatedAs(2L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new UserRoleUpdateRequest(GlobalRole.ADMINISTRADOR))))
                .andExpect(status().isForbidden());
    }

    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
