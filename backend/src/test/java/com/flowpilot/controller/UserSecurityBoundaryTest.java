package com.flowpilot.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.security.CookieService;
import com.flowpilot.security.JwtService;
import com.flowpilot.security.SecurityConfig;
import com.flowpilot.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Exercises {@code GET /api/users} through the real {@link SecurityConfig}
 * filter chain (spec: user-directory, scenario "Unauthenticated access").
 * Unlike {@link UserControllerTest} (standalone MockMvc, no security
 * filters), this loads the actual {@code SecurityFilterChain} so the
 * 401-without-a-valid-JWT behavior is proven end to end without requiring
 * Docker/Testcontainers.
 *
 * <p>The positive "valid Bearer token authenticates and reaches the
 * controller" behavior is covered instead by {@link
 * com.flowpilot.security.JwtAuthenticationFilterTest} (proves the filter
 * populates {@code SecurityContextHolder} for a valid token) and by the
 * Testcontainers-backed {@code AuthFlowIntegrationTest}-style full-stack
 * path (Docker-gated, not runnable in this sandbox) — a {@code @WebMvcTest}
 * slice combined with a mocked {@link JwtService} was found to exhibit
 * ThreadLocal {@code SecurityContext} propagation quirks unrelated to
 * production behavior, so it is intentionally not used to assert the
 * 200 case here.
 */
@WebMvcTest(UserController.class)
@Import(SecurityConfig.class)
class UserSecurityBoundaryTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private CookieService cookieService;

    @Test
    void listUsersWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isUnauthorized());
    }
}
