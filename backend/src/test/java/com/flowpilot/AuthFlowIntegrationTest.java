package com.flowpilot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.LoginRequest;
import com.flowpilot.dto.RegisterRequest;
import com.flowpilot.security.CookieService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Full-stack login -&gt; refresh -&gt; logout flow against a real Postgres
 * container (design's JWT/Refresh Flow section, task 1.6). Requires Docker —
 * runs in CI (Testcontainers-backed), same as {@link FlowpilotApplicationTests}.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIntegrationTest {

    /** Mirrors {@code CsrfProtectionFilter}'s expected header name for the double-submit check. */
    private static final String CSRF_HEADER_NAME = "X-XSRF-TOKEN";

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("flowpilot")
            .withUsername("flowpilot")
            .withPassword("flowpilot");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void fullLoginRefreshLogoutFlowSucceeds() throws Exception {
        RegisterRequest register = new RegisterRequest("Grace Hopper", "grace@flowpilot.local", "supersecret1");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(register)))
                .andExpect(status().isCreated());

        LoginRequest login = new LoginRequest("grace@flowpilot.local", "supersecret1");
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andReturn();

        Cookie refreshCookie = loginResult.getResponse().getCookie("refreshToken");
        assertThat(refreshCookie).isNotNull();
        assertThat(refreshCookie.isHttpOnly()).isTrue();

        Cookie csrfCookie = loginResult.getResponse().getCookie(CookieService.CSRF_COOKIE_NAME);
        assertThat(csrfCookie).isNotNull();

        MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie, csrfCookie)
                        .header(CSRF_HEADER_NAME, csrfCookie.getValue()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andReturn();

        Cookie rotatedCookie = refreshResult.getResponse().getCookie("refreshToken");
        assertThat(rotatedCookie).isNotNull();
        assertThat(rotatedCookie.getValue()).isNotEqualTo(refreshCookie.getValue());

        Cookie rotatedCsrfCookie = refreshResult.getResponse().getCookie(CookieService.CSRF_COOKIE_NAME);
        assertThat(rotatedCsrfCookie).isNotNull();

        // Reusing the original (now-revoked) refresh token must fail.
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie, csrfCookie)
                        .header(CSRF_HEADER_NAME, csrfCookie.getValue()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/logout")
                        .cookie(rotatedCookie, rotatedCsrfCookie)
                        .header(CSRF_HEADER_NAME, rotatedCsrfCookie.getValue()))
                .andExpect(status().isNoContent());

        // The rotated token is now revoked too; refresh must fail after logout.
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(rotatedCookie, rotatedCsrfCookie)
                        .header(CSRF_HEADER_NAME, rotatedCsrfCookie.getValue()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePasswordIssuesAFreshRefreshCookieAndRevokesTheOldOne() throws Exception {
        RegisterRequest register = new RegisterRequest("Ada Lovelace", "ada@flowpilot.local", "supersecret1");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(register)))
                .andExpect(status().isCreated());

        LoginRequest login = new LoginRequest("ada@flowpilot.local", "supersecret1");
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(login)))
                .andExpect(status().isOk())
                .andReturn();

        String accessToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .get("accessToken").asText();
        Cookie oldRefreshCookie = loginResult.getResponse().getCookie("refreshToken");
        assertThat(oldRefreshCookie).isNotNull();
        Cookie csrfCookie = loginResult.getResponse().getCookie(CookieService.CSRF_COOKIE_NAME);
        assertThat(csrfCookie).isNotNull();

        // Changing the password does not carry the /api/auth-scoped refresh
        // cookie at all (its Path attribute excludes this endpoint) — it must
        // still come back with a brand-new one for the current session.
        MvcResult changePasswordResult = mockMvc.perform(put("/api/users/me/password")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"supersecret1\",\"newPassword\":\"newsupersecret1\"}"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie newRefreshCookie = changePasswordResult.getResponse().getCookie("refreshToken");
        assertThat(newRefreshCookie).isNotNull();
        assertThat(newRefreshCookie.isHttpOnly()).isTrue();
        assertThat(newRefreshCookie.getValue()).isNotEqualTo(oldRefreshCookie.getValue());

        // The fresh cookie rotates successfully — no reuse-detection false positive.
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(newRefreshCookie, csrfCookie)
                        .header(CSRF_HEADER_NAME, csrfCookie.getValue()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists());

        // The pre-password-change refresh token is genuinely revoked and rejected.
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(oldRefreshCookie, csrfCookie)
                        .header(CSRF_HEADER_NAME, csrfCookie.getValue()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginWithDeactivatedAdminSeedRejects() throws Exception {
        // Sanity check against real V1/V2 migration data: wrong password on the seeded admin -> 401.
        LoginRequest wrongPassword = new LoginRequest("admin@flowpilot.local", "not-the-real-password");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(wrongPassword)))
                .andExpect(status().isUnauthorized());
    }
}
