package com.flowpilot.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.security.JwtService;
import com.flowpilot.security.SecurityConfig;
import com.flowpilot.service.BoardService;
import com.flowpilot.service.WorkItemService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Exercises {@code /api/projects/{id}/work-items} and {@code
 * /api/work-items/{id}} (including {@code /move}) through the real {@link
 * SecurityConfig} filter chain, mirroring {@link
 * ProjectMemberSecurityBoundaryTest}. Proves unauthenticated requests are
 * rejected with 401.
 */
@WebMvcTest(WorkItemController.class)
@Import(SecurityConfig.class)
class WorkItemSecurityBoundaryTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private WorkItemService workItemService;

    @MockitoBean
    private BoardService boardService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void listWorkItemsWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/projects/1/work-items"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createWorkItemWithoutTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/projects/1/work-items")
                        .contentType("application/json")
                        .content("{\"title\":\"Task\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getWorkItemWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/work-items/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void moveWorkItemWithoutTokenReturns401() throws Exception {
        mockMvc.perform(put("/api/work-items/1/move")
                        .contentType("application/json")
                        .content("{\"columnId\":1,\"position\":0}"))
                .andExpect(status().isUnauthorized());
    }
}
