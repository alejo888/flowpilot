package com.flowpilot.controller;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.config.AiSettings;
import com.flowpilot.security.JwtService;
import com.flowpilot.security.SecurityConfig;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Slice test for {@code GET /api/ai/config} (spec: ai-runtime-config — "Expose
 * AI availability"). Runs through the real {@link SecurityConfig} filter chain:
 * an authenticated caller gets 200 with the current {@code flowpilot.ai.enabled}
 * value (sourced from the {@link AiSettings} bean), an anonymous caller gets 401.
 */
@WebMvcTest(AiConfigController.class)
@Import(SecurityConfig.class)
class AiConfigControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AiSettings aiSettings;

    @MockitoBean
    private JwtService jwtService;

    private static UsernamePasswordAuthenticationToken authenticatedAs(long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }

    @Test
    void reportsEnabledTrueWhenFlagIsOn() throws Exception {
        when(aiSettings.enabled()).thenReturn(true);

        mockMvc.perform(get("/api/ai/config").with(authentication(authenticatedAs(7L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    void reportsEnabledFalseWhenFlagIsOff() throws Exception {
        when(aiSettings.enabled()).thenReturn(false);

        mockMvc.perform(get("/api/ai/config").with(authentication(authenticatedAs(7L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    void unauthenticatedRequestReturns401() throws Exception {
        mockMvc.perform(get("/api/ai/config"))
                .andExpect(status().isUnauthorized());
    }
}
