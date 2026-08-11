package com.flowpilot.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.security.JwtService;
import com.flowpilot.security.SecurityConfig;
import com.flowpilot.service.ProjectService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Exercises {@code /api/projects} through the real {@link SecurityConfig}
 * filter chain, mirroring {@link UserSecurityBoundaryTest}. Proves
 * unauthenticated requests to project endpoints are rejected with 401
 * (Docker-gated end-to-end curl walkthrough deferred to CI, same constraint
 * as prior slices).
 */
@WebMvcTest(ProjectController.class)
@Import(SecurityConfig.class)
class ProjectSecurityBoundaryTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProjectService projectService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void listProjectsWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createProjectWithoutTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/projects")
                        .contentType("application/json")
                        .content("{\"name\":\"Apollo\"}"))
                .andExpect(status().isUnauthorized());
    }
}
