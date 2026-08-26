package com.flowpilot.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.SprintCreateRequest;
import com.flowpilot.dto.SprintResponse;
import com.flowpilot.dto.SprintUpdateRequest;
import com.flowpilot.entity.SprintStatus;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.service.SprintService;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * Sprint create/update endpoints (spec: backlog and sprints). Verifies the
 * oversized-name validation gap fixed alongside item 2 of the module 7
 * cleanup pass: an over-255-char name must return 400 (validation error),
 * never fall through to a DB-truncation 409 — mirrors {@code
 * WorkItemControllerTest}'s equivalent title-length tests.
 */
@ExtendWith(MockitoExtension.class)
class SprintControllerTest {

    @Mock
    private SprintService sprintService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        SprintController controller = new SprintController(sprintService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void createReturns201() throws Exception {
        SprintResponse response = sprintResponse(1L, 10L, "Sprint 1");
        when(sprintService.create(eq(10L), any(SprintCreateRequest.class), eq(1L))).thenReturn(response);

        mockMvc.perform(post("/api/projects/10/sprints")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new SprintCreateRequest(
                                        "Sprint 1", "Goal", LocalDate.now(), LocalDate.now().plusDays(7)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Sprint 1"));
    }

    @Test
    void createWithNameOver255CharsReturns400ValidationErrorNotConflict() throws Exception {
        String tooLongName = "a".repeat(256);

        mockMvc.perform(post("/api/projects/10/sprints")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new SprintCreateRequest(
                                        tooLongName, "Goal", LocalDate.now(), LocalDate.now().plusDays(7)))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateWithNameOver255CharsReturns400ValidationErrorNotConflict() throws Exception {
        String tooLongName = "a".repeat(256);

        mockMvc.perform(put("/api/sprints/1")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new SprintUpdateRequest(
                                        tooLongName, "Goal", LocalDate.now(), LocalDate.now().plusDays(7)))))
                .andExpect(status().isBadRequest());
    }

    private SprintResponse sprintResponse(Long id, Long projectId, String name) {
        OffsetDateTime now = OffsetDateTime.now();
        return new SprintResponse(
                id, projectId, name, "Goal", LocalDate.now(), LocalDate.now().plusDays(7),
                SprintStatus.PLANNED, now, now);
    }

    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
