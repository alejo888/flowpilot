package com.flowpilot.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.BoardColumnResponse;
import com.flowpilot.dto.ProjectCreateRequest;
import com.flowpilot.dto.ProjectResponse;
import com.flowpilot.dto.ProjectStatusUpdateRequest;
import com.flowpilot.dto.ProjectUpdateRequest;
import com.flowpilot.entity.ProjectStatus;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.service.ProjectService;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ProjectControllerTest {

    @Mock
    private ProjectService projectService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        ProjectController controller = new ProjectController(projectService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void createProjectReturns201WithSeededOwner() throws Exception {
        ProjectResponse response = projectResponse(1L, "Apollo", 42L, ProjectStatus.PLANIFICACION);
        when(projectService.create(any(ProjectCreateRequest.class), eq(42L))).thenReturn(response);

        mockMvc.perform(post("/api/projects")
                        .principal(authenticatedAs(42L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new ProjectCreateRequest("Apollo", "desc"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.ownerId").value(42));
    }

    @Test
    void updateWithoutPermissionReturns403() throws Exception {
        when(projectService.update(eq(1L), any(ProjectUpdateRequest.class), eq(99L)))
                .thenThrow(new AccessDeniedException("Not the project owner or an administrator"));

        mockMvc.perform(put("/api/projects/1")
                        .principal(authenticatedAs(99L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new ProjectUpdateRequest("New", "desc"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void statusTransitionByAuthorizedUserReturns200() throws Exception {
        ProjectResponse response = projectResponse(1L, "Apollo", 42L, ProjectStatus.ACTIVO);
        when(projectService.updateStatus(eq(1L), any(ProjectStatusUpdateRequest.class), eq(42L)))
                .thenReturn(response);

        mockMvc.perform(patch("/api/projects/1/status")
                        .principal(authenticatedAs(42L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new ProjectStatusUpdateRequest(ProjectStatus.ACTIVO))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVO"));
    }

    @Test
    void deleteWithoutPermissionReturns403() throws Exception {
        org.mockito.Mockito.doThrow(new AccessDeniedException("Not the project owner or an administrator"))
                .when(projectService).delete(1L, 99L);

        mockMvc.perform(delete("/api/projects/1").principal(authenticatedAs(99L)))
                .andExpect(status().isForbidden());

        verify(projectService).delete(1L, 99L);
    }

    @Test
    void getByIdReturns404WhenMissing() throws Exception {
        when(projectService.findById(99L)).thenThrow(new ProjectNotFoundException(99L));

        mockMvc.perform(get("/api/projects/99").principal(authenticatedAs(1L)))
                .andExpect(status().isNotFound());
    }

    @Test
    void listBoardColumnsReturnsOrderedColumns() throws Exception {
        when(projectService.listBoardColumns(1L)).thenReturn(List.of(
                new BoardColumnResponse(1L, "Por hacer", 1024),
                new BoardColumnResponse(2L, "En progreso", 2048)));

        mockMvc.perform(get("/api/projects/1/board-columns").principal(authenticatedAs(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Por hacer"));
    }

    private ProjectResponse projectResponse(Long id, String name, Long ownerId, ProjectStatus status) {
        OffsetDateTime now = OffsetDateTime.now();
        return new ProjectResponse(id, name, "desc", status, ownerId, now, now);
    }

    /**
     * Standalone MockMvc has no security filter chain, so the controller's
     * {@code Authentication} argument is supplied directly as the request
     * principal (mirrors {@code JwtAuthenticationFilter}'s principal shape:
     * the userId as a string).
     */
    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
