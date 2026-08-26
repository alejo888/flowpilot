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
import com.flowpilot.security.CookieService;
import com.flowpilot.service.UserService;
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

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    private final CookieService cookieService = new CookieService(7);

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        UserController controller = new UserController(userService, cookieService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listUsersReturns200WithSummaries() throws Exception {
        when(userService.listUsers(eq(42L))).thenReturn(List.of(
                new UserSummaryResponse(1L, "Ada Lovelace", "ada@flowpilot.local"),
                new UserSummaryResponse(2L, "Grace Hopper", "grace@flowpilot.local")));

        mockMvc.perform(get("/api/users").principal(authenticatedAs(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Ada Lovelace"))
                .andExpect(jsonPath("$[0].email").value("ada@flowpilot.local"))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }

    @Test
    void listUsersReturns403WhenCallerIsDeactivated() throws Exception {
        when(userService.listUsers(eq(42L))).thenThrow(new AccessDeniedException("La cuenta está desactivada"));

        mockMvc.perform(get("/api/users").principal(authenticatedAs(42L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("La cuenta está desactivada"));
    }

    @Test
    void getUserByIdReturns200() throws Exception {
        when(userService.findById(eq(42L), eq(3L)))
                .thenReturn(new UserSummaryResponse(3L, "Katherine Johnson", "katherine@flowpilot.local"));

        mockMvc.perform(get("/api/users/3").principal(authenticatedAs(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(3))
                .andExpect(jsonPath("$.name").value("Katherine Johnson"))
                .andExpect(jsonPath("$.email").value("katherine@flowpilot.local"));
    }

    @Test
    void getUserByIdReturns404WhenNotFound() throws Exception {
        when(userService.findById(eq(42L), eq(99L))).thenThrow(new UserNotFoundException(99L));

        mockMvc.perform(get("/api/users/99").principal(authenticatedAs(42L)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getUserByIdReturns403WhenCallerIsDeactivated() throws Exception {
        when(userService.findById(eq(42L), eq(3L)))
                .thenThrow(new AccessDeniedException("La cuenta está desactivada"));

        mockMvc.perform(get("/api/users/3").principal(authenticatedAs(42L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("La cuenta está desactivada"));
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
        when(userService.changePassword(eq(42L), eq("oldSecret1"), eq("newSecret1")))
                .thenReturn("fresh-raw-refresh-token");

        mockMvc.perform(put("/api/users/me/password")
                        .principal(authenticatedAs(42L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"oldSecret1\",\"newPassword\":\"newSecret1\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void changePasswordSetsAFreshRefreshTokenCookieOnSuccess() throws Exception {
        when(userService.changePassword(eq(42L), eq("oldSecret1"), eq("newSecret1")))
                .thenReturn("fresh-raw-refresh-token");

        mockMvc.perform(put("/api/users/me/password")
                        .principal(authenticatedAs(42L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"oldSecret1\",\"newPassword\":\"newSecret1\"}"))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String setCookie = result.getResponse().getHeader("Set-Cookie");
                    org.assertj.core.api.Assertions.assertThat(setCookie).isNotNull();
                    org.assertj.core.api.Assertions.assertThat(setCookie)
                            .contains("refreshToken=fresh-raw-refresh-token")
                            .contains("HttpOnly");
                });
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

    /**
     * BCrypt only consumes a password's first 72 bytes; without an upper
     * {@code @Size} bound, an oversized password either silently
     * truncates-and-collides or throws an unhandled {@code
     * IllegalArgumentException} that falls through to a 500 instead of a
     * proper validation error.
     */
    @Test
    void changePasswordReturns400WhenNewPasswordIsTooLongNotFiveHundred() throws Exception {
        String oversized = "a".repeat(73);

        mockMvc.perform(put("/api/users/me/password")
                        .principal(authenticatedAs(42L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"oldSecret1\",\"newPassword\":\"" + oversized + "\"}"))
                .andExpect(status().isBadRequest());

        org.mockito.Mockito.verifyNoInteractions(userService);
    }

    @Test
    void getCurrentUserReturns403WhenCallerIsDeactivated() throws Exception {
        when(userService.getProfile(eq(42L)))
                .thenThrow(new AccessDeniedException("La cuenta está desactivada"));

        mockMvc.perform(get("/api/users/me").principal(authenticatedAs(42L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("La cuenta está desactivada"));
    }

    @Test
    void changePasswordReturns403WhenCallerIsDeactivated() throws Exception {
        org.mockito.Mockito.doThrow(new AccessDeniedException("La cuenta está desactivada"))
                .when(userService).changePassword(eq(42L), eq("oldSecret1"), eq("newSecret1"));

        mockMvc.perform(put("/api/users/me/password")
                        .principal(authenticatedAs(42L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"oldSecret1\",\"newPassword\":\"newSecret1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("La cuenta está desactivada"));
    }

    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
