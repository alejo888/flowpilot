package com.flowpilot.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.exception.InvalidCurrentPasswordException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.service.UserService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        UserController controller = new UserController(userService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listUsersReturns200WithSummaries() throws Exception {
        when(userService.listUsers()).thenReturn(List.of(
                new UserSummaryResponse(1L, "Ada Lovelace", "ada@flowpilot.local"),
                new UserSummaryResponse(2L, "Grace Hopper", "grace@flowpilot.local")));

        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Ada Lovelace"))
                .andExpect(jsonPath("$[0].email").value("ada@flowpilot.local"))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }

    @Test
    void getUserByIdReturns200() throws Exception {
        when(userService.findById(eq(3L)))
                .thenReturn(new UserSummaryResponse(3L, "Katherine Johnson", "katherine@flowpilot.local"));

        mockMvc.perform(get("/api/users/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(3))
                .andExpect(jsonPath("$.name").value("Katherine Johnson"))
                .andExpect(jsonPath("$.email").value("katherine@flowpilot.local"));
    }

    @Test
    void getUserByIdReturns404WhenNotFound() throws Exception {
        when(userService.findById(eq(99L))).thenThrow(new UserNotFoundException(99L));

        mockMvc.perform(get("/api/users/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getCurrentUserReturns200WithOwnProfile() throws Exception {
        when(userService.getProfile(eq(42L)))
                .thenReturn(new UserAdminResponse(42L, "Ada Lovelace", "ada@flowpilot.local", GlobalRole.MIEMBRO_EQUIPO, true));

        mockMvc.perform(get("/api/users/me").principal(authenticatedAs(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.name").value("Ada Lovelace"))
                .andExpect(jsonPath("$.email").value("ada@flowpilot.local"))
                .andExpect(jsonPath("$.role").value("MIEMBRO_EQUIPO"));
    }

    @Test
    void changePasswordReturns200OnSuccess() throws Exception {
        mockMvc.perform(put("/api/users/me/password")
                        .principal(authenticatedAs(42L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"oldSecret1\",\"newPassword\":\"newSecret1\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void changePasswordReturns400WhenCurrentPasswordIsWrong() throws Exception {
        org.mockito.Mockito.doThrow(new InvalidCurrentPasswordException("La contraseña actual no es correcta"))
                .when(userService).changePassword(eq(42L), eq("wrongSecret"), eq("newSecret1"));

        mockMvc.perform(put("/api/users/me/password")
                        .principal(authenticatedAs(42L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"wrongSecret\",\"newPassword\":\"newSecret1\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void changePasswordReturns400WhenNewPasswordIsTooShort() throws Exception {
        mockMvc.perform(put("/api/users/me/password")
                        .principal(authenticatedAs(42L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"oldSecret1\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }

    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
