package com.flowpilot.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.ForgotPasswordRequest;
import com.flowpilot.dto.LoginRequest;
import com.flowpilot.dto.RegisterRequest;
import com.flowpilot.dto.ResetPasswordRequest;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import com.flowpilot.exception.DuplicateEmailException;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.exception.InvalidRefreshTokenException;
import com.flowpilot.exception.InvalidResetTokenException;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.security.AuthRateLimiter;
import com.flowpilot.security.CookieService;
import com.flowpilot.security.JwtService;
import com.flowpilot.service.AuthService;
import com.flowpilot.service.PasswordResetService;
import com.flowpilot.service.RefreshTokenService;
import java.lang.reflect.Field;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private UserRepository userRepository;
    @Mock
    private JwtService jwtService;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private PasswordResetService passwordResetService;

    private final CookieService cookieService = new CookieService(7);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private AuthRateLimiter authRateLimiter;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        authRateLimiter = new AuthRateLimiter();
        AuthController controller = new AuthController(
                authService, authenticationManager, userRepository, jwtService,
                refreshTokenService, passwordResetService, cookieService, authRateLimiter);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void registerReturns201() throws Exception {
        RegisterRequest request = new RegisterRequest("Ada", "ada@flowpilot.local", "supersecret1");

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isCreated());
    }

    @Test
    void registerWithDuplicateEmailReturns409() throws Exception {
        RegisterRequest request = new RegisterRequest("Ada", "ada@flowpilot.local", "supersecret1");
        when(authService.register(any())).thenThrow(new DuplicateEmailException());

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("El email ya está registrado"));
    }

    @Test
    void registerWithEmailWithoutTldReturns400() throws Exception {
        RegisterRequest request = new RegisterRequest("Ada", "alejo@gmail", "supersecret1");

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").value("El email debe tener un formato válido"));
    }

    @Test
    void registerWithMalformedEmailReturns400() throws Exception {
        RegisterRequest request = new RegisterRequest("Ada", "notanemail", "supersecret1");

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void forgotPasswordWithEmailWithoutTldReturns200() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest("alejo@gmail");

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isOk());
    }

    @Test
    void forgotPasswordWithMalformedEmailReturns400() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest("notanemail");

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginLooksUpTheUserWithTheNormalizedEmail() throws Exception {
        LoginRequest request = new LoginRequest("Ada@FlowPilot.Local", "supersecret1");
        User user = activeUser(3L);
        Authentication authenticated = new UsernamePasswordAuthenticationToken(user.getEmail(), null);
        when(authenticationManager.authenticate(any())).thenReturn(authenticated);
        when(userRepository.findByEmail("ada@flowpilot.local")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("signed-access-token");
        when(jwtService.getAccessTokenTtlSeconds()).thenReturn(900L);
        when(refreshTokenService.issue(user)).thenReturn("raw-refresh-token");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isOk());
    }

    @Test
    void loginWithValidCredentialsReturns200WithAccessTokenAndRefreshCookie() throws Exception {
        LoginRequest request = new LoginRequest("ada@flowpilot.local", "supersecret1");
        User user = activeUser(1L);
        Authentication authenticated = new UsernamePasswordAuthenticationToken(user.getEmail(), null);
        when(authenticationManager.authenticate(any())).thenReturn(authenticated);
        when(userRepository.findByEmail("ada@flowpilot.local")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("signed-access-token");
        when(jwtService.getAccessTokenTtlSeconds()).thenReturn(900L);
        when(refreshTokenService.issue(user)).thenReturn("raw-refresh-token");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("signed-access-token"))
                .andExpect(jsonPath("$.expiresIn").value(900))
                .andExpect(result -> {
                    var cookies = result.getResponse().getCookies();
                    assertThat(java.util.Arrays.stream(cookies).map(jakarta.servlet.http.Cookie::getName))
                            .contains("refreshToken", "XSRF-TOKEN");
                });
    }

    @Test
    void loginWithBadCredentialsReturns401() throws Exception {
        LoginRequest request = new LoginRequest("ada@flowpilot.local", "wrong-password");
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginWithDeactivatedAccountReturns401() throws Exception {
        LoginRequest request = new LoginRequest("ada@flowpilot.local", "supersecret1");
        when(authenticationManager.authenticate(any())).thenThrow(new DisabledException("disabled"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshWithValidCookieReturns200WithNewAccessTokenAndRotatedCookie() throws Exception {
        User user = activeUser(2L);
        when(refreshTokenService.rotate("old-raw-token"))
                .thenReturn(new RefreshTokenService.RotationResult("new-raw-token", user));
        when(jwtService.generateAccessToken(user)).thenReturn("new-access-token");
        when(jwtService.getAccessTokenTtlSeconds()).thenReturn(900L);

        mockMvc.perform(post("/api/auth/refresh").cookie(new jakarta.servlet.http.Cookie("refreshToken", "old-raw-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access-token"))
                .andExpect(result -> {
                    var cookies = result.getResponse().getCookies();
                    assertThat(java.util.Arrays.stream(cookies).map(jakarta.servlet.http.Cookie::getName))
                            .contains("refreshToken", "XSRF-TOKEN");
                });
    }

    @Test
    void refreshWithoutCookieReturns401() throws Exception {
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshWithReusedTokenReturns401() throws Exception {
        when(refreshTokenService.rotate("reused-token"))
                .thenThrow(new InvalidRefreshTokenException("Refresh token reuse detected"));

        mockMvc.perform(post("/api/auth/refresh").cookie(new jakarta.servlet.http.Cookie("refreshToken", "reused-token")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesTokenAndClearsCookieReturns204() throws Exception {
        mockMvc.perform(post("/api/auth/logout").cookie(new jakarta.servlet.http.Cookie("refreshToken", "raw-token")))
                .andExpect(status().isNoContent());

        org.mockito.Mockito.verify(refreshTokenService).revoke("raw-token");
    }

    @Test
    void forgotPasswordAlwaysReturns200() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest("anyone@flowpilot.local");

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isOk());
    }

    @Test
    void repeatedFailedLoginsAreThrottledWith429() throws Exception {
        LoginRequest request = new LoginRequest("ada@flowpilot.local", "wrong-password");
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsBytes(request)))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.detail")
                        .value("Demasiados intentos. Intenta nuevamente en unos minutos"));
    }

    @Test
    void successfulLoginsAreNotThrottled() throws Exception {
        LoginRequest request = new LoginRequest("ada@flowpilot.local", "supersecret1");
        User user = activeUser(1L);
        Authentication authenticated = new UsernamePasswordAuthenticationToken(user.getEmail(), null);
        when(authenticationManager.authenticate(any())).thenReturn(authenticated);
        when(userRepository.findByEmail("ada@flowpilot.local")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("signed-access-token");
        when(jwtService.getAccessTokenTtlSeconds()).thenReturn(900L);
        when(refreshTokenService.issue(user)).thenReturn("raw-refresh-token");

        for (int attempt = 0; attempt < 8; attempt++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsBytes(request)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void repeatedForgotPasswordRequestsAreThrottledWith429() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest("anyone@flowpilot.local");

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/auth/forgot-password")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsBytes(request)))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void malformedJsonBodyReturns400ThroughRealDispatch() throws Exception {
        // Dispatched for real (not by calling the advice method directly) so this
        // proves Spring resolves HttpMessageNotReadableException to the specific
        // handler instead of the Exception.class catch-all, which would be a 500.
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\": \"ada@flowpilot.local\", "))
                .andExpect(status().isBadRequest());
    }

    @Test
    void failedLoginsFromOneForwardedClientDoNotThrottleAnotherClient() throws Exception {
        LoginRequest request = new LoginRequest("ada@flowpilot.local", "wrong-password");
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/auth/login")
                            .header("X-Forwarded-For", "203.0.113.9")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsBytes(request)))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "203.0.113.9")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isTooManyRequests());

        // Behind nginx every user would otherwise share the proxy's IP; a real
        // second client must keep its own budget.
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "198.51.100.7")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void successfulLoginDoesNotClearTheSharedIpBudget() throws Exception {
        User user = activeUser(4L);
        when(authenticationManager.authenticate(any())).thenAnswer(invocation -> {
            Authentication token = invocation.getArgument(0);
            if ("attacker@flowpilot.local".equals(token.getName())) {
                return new UsernamePasswordAuthenticationToken(token.getName(), null);
            }
            throw new BadCredentialsException("bad");
        });
        when(userRepository.findByEmail("attacker@flowpilot.local")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("signed-access-token");
        when(jwtService.getAccessTokenTtlSeconds()).thenReturn(900L);
        when(refreshTokenService.issue(user)).thenReturn("raw-refresh-token");

        // Spray a few victims, staying under the per-account ceiling each time.
        for (int attempt = 0; attempt < 4; attempt++) {
            LoginRequest spray = new LoginRequest("victim" + attempt + "@flowpilot.local", "guess");
            mockMvc.perform(post("/api/auth/login")
                            .header("X-Forwarded-For", "203.0.113.9")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsBytes(spray)))
                    .andExpect(status().isUnauthorized());
        }

        // The attacker logs into their own valid account…
        LoginRequest own = new LoginRequest("attacker@flowpilot.local", "supersecret1");
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "203.0.113.9")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(own)))
                .andExpect(status().isOk());

        // …which must not wipe the IP-scoped counter: the 5th spray still fits the
        // budget, the 6th is rejected. Had the success reset the IP key, both
        // would have come back 401.
        LoginRequest fifth = new LoginRequest("victim98@flowpilot.local", "guess");
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "203.0.113.9")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(fifth)))
                .andExpect(status().isUnauthorized());

        LoginRequest sixth = new LoginRequest("victim99@flowpilot.local", "guess");
        mockMvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", "203.0.113.9")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(sixth)))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void resetPasswordWithInvalidTokenReturns400() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest("bad-token", "newSecret1");
        org.mockito.Mockito.doThrow(new InvalidResetTokenException("Unknown reset token"))
                .when(passwordResetService).resetPassword("bad-token", "newSecret1");

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
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
    void resetPasswordWithOversizedNewPasswordReturns400NotFiveHundred() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest("some-token", "a".repeat(73));

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isBadRequest());

        org.mockito.Mockito.verifyNoInteractions(passwordResetService);
    }

    private User activeUser(Long id) throws Exception {
        User user = new User("Name " + id, "user" + id + "@flowpilot.local", "hash", GlobalRole.MIEMBRO_EQUIPO, true);
        Field field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }
}
