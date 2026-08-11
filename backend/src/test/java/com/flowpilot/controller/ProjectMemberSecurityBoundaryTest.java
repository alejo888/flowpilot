package com.flowpilot.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.security.JwtService;
import com.flowpilot.security.SecurityConfig;
import com.flowpilot.service.ProjectMemberService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Exercises {@code /api/projects/{id}/members} through the real
 * {@link SecurityConfig} filter chain, mirroring {@link ProjectSecurityBoundaryTest}.
 * Proves unauthenticated requests to member endpoints are rejected with 401.
 */
@WebMvcTest(ProjectMemberController.class)
@Import(SecurityConfig.class)
class ProjectMemberSecurityBoundaryTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProjectMemberService projectMemberService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void listMembersWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/projects/1/members"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void addMemberWithoutTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/projects/1/members")
                        .contentType("application/json")
                        .content("{\"userId\":2,\"role\":\"DEVELOPER\"}"))
                .andExpect(status().isUnauthorized());
    }
}
