package com.flowpilot.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.WorkItemCreateRequest;
import com.flowpilot.dto.WorkItemMoveRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.dto.WorkItemUpdateRequest;
import com.flowpilot.exception.CrossProjectColumnException;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.service.BoardService;
import com.flowpilot.service.WorkItemService;
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

/**
 * WorkItem CRUD + move endpoints (spec: work-items, kanban-board). Verifies
 * the 201/200/204 happy paths and, per spec's "Edit/delete without
 * permission" scenario, that unauthorized PUT/DELETE return 403. The move
 * endpoint additionally verifies the "Cross-project column" scenario (400).
 */
@ExtendWith(MockitoExtension.class)
class WorkItemControllerTest {

    @Mock
    private WorkItemService workItemService;

    @Mock
    private BoardService boardService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        WorkItemController controller = new WorkItemController(workItemService, boardService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void createReturns201() throws Exception {
        WorkItemResponse response = workItemResponse(500L, 10L, 200L, "Design schema", 1024);
        when(workItemService.create(eq(10L), any(WorkItemCreateRequest.class), eq(1L)))
                .thenReturn(response);

        mockMvc.perform(post("/api/projects/10/work-items")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new WorkItemCreateRequest("Design schema", null, null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.columnId").value(200))
                .andExpect(jsonPath("$.title").value("Design schema"));
    }

    @Test
    void createWithTitleOver255CharsReturns400ValidationErrorNotConflict() throws Exception {
        String tooLongTitle = "a".repeat(256);

        mockMvc.perform(post("/api/projects/10/work-items")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new WorkItemCreateRequest(tooLongTitle, null, null))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateWithTitleOver255CharsReturns400ValidationErrorNotConflict() throws Exception {
        String tooLongTitle = "a".repeat(256);

        mockMvc.perform(put("/api/work-items/500")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new WorkItemUpdateRequest(tooLongTitle, null, null))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createByUnauthorizedUserReturns403() throws Exception {
        when(workItemService.create(eq(10L), any(WorkItemCreateRequest.class), eq(2L)))
                .thenThrow(new AccessDeniedException("Not the project owner or an administrator"));

        mockMvc.perform(post("/api/projects/10/work-items")
                        .principal(authenticatedAs(2L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new WorkItemCreateRequest("Task", null, null))))
                .andExpect(status().isForbidden());
    }

    @Test
    void listReturnsItems() throws Exception {
        when(workItemService.list(10L, 1L)).thenReturn(List.of(
                workItemResponse(500L, 10L, 200L, "A", 1024),
                workItemResponse(501L, 10L, 200L, "B", 2048)));

        mockMvc.perform(get("/api/projects/10/work-items").principal(authenticatedAs(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("A"));
    }

    @Test
    void getByIdReturns200() throws Exception {
        when(workItemService.findById(500L, 1L)).thenReturn(workItemResponse(500L, 10L, 200L, "A", 1024));

        mockMvc.perform(get("/api/work-items/500").principal(authenticatedAs(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(500));
    }

    @Test
    void getByIdMissingReturns404() throws Exception {
        when(workItemService.findById(999L, 1L)).thenThrow(new WorkItemNotFoundException(999L));

        mockMvc.perform(get("/api/work-items/999").principal(authenticatedAs(1L)))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateReturns200() throws Exception {
        WorkItemResponse response = workItemResponse(500L, 10L, 200L, "Updated", 1024);
        when(workItemService.update(eq(500L), any(WorkItemUpdateRequest.class), eq(1L)))
                .thenReturn(response);

        mockMvc.perform(put("/api/work-items/500")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new WorkItemUpdateRequest("Updated", null, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated"));
    }

    @Test
    void updateByUnauthorizedUserReturns403() throws Exception {
        when(workItemService.update(eq(500L), any(WorkItemUpdateRequest.class), eq(2L)))
                .thenThrow(new AccessDeniedException("Not the project owner or an administrator"));

        mockMvc.perform(put("/api/work-items/500")
                        .principal(authenticatedAs(2L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new WorkItemUpdateRequest("Updated", null, null))))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(delete("/api/work-items/500").principal(authenticatedAs(1L)))
                .andExpect(status().isNoContent());

        verify(workItemService).delete(500L, 1L);
    }

    @Test
    void deleteByUnauthorizedUserReturns403() throws Exception {
        org.mockito.Mockito.doThrow(new AccessDeniedException("Not the project owner or an administrator"))
                .when(workItemService).delete(500L, 2L);

        mockMvc.perform(delete("/api/work-items/500").principal(authenticatedAs(2L)))
                .andExpect(status().isForbidden());
    }

    @Test
    void moveReturns200() throws Exception {
        WorkItemResponse response = workItemResponse(500L, 10L, 300L, "Moved", 2048);
        when(boardService.move(org.mockito.ArgumentMatchers.eq(500L), any(WorkItemMoveRequest.class),
                org.mockito.ArgumentMatchers.eq(1L)))
                .thenReturn(response);

        mockMvc.perform(put("/api/work-items/500/move")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new WorkItemMoveRequest(300L, 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.columnId").value(300))
                .andExpect(jsonPath("$.position").value(2048));
    }

    @Test
    void moveToColumnFromAnotherProjectReturns400() throws Exception {
        when(boardService.move(org.mockito.ArgumentMatchers.eq(500L), any(WorkItemMoveRequest.class),
                org.mockito.ArgumentMatchers.eq(1L)))
                .thenThrow(new CrossProjectColumnException(300L, 10L));

        mockMvc.perform(put("/api/work-items/500/move")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new WorkItemMoveRequest(300L, 0))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void moveByUnauthorizedUserReturns403() throws Exception {
        when(boardService.move(org.mockito.ArgumentMatchers.eq(500L), any(WorkItemMoveRequest.class),
                org.mockito.ArgumentMatchers.eq(2L)))
                .thenThrow(new AccessDeniedException("Not authorized to move this work item"));

        mockMvc.perform(put("/api/work-items/500/move")
                        .principal(authenticatedAs(2L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new WorkItemMoveRequest(300L, 0))))
                .andExpect(status().isForbidden());
    }

    @Test
    void getByIdIncludesHierarchyFields() throws Exception {
        OffsetDateTime now = OffsetDateTime.now();
        WorkItemResponse response = new WorkItemResponse(
                501L, 10L, 200L, "Subtarea", null, null, null, 1024, now, now,
                null, com.flowpilot.entity.WorkItemPriority.MEDIUM, null, List.of(), false, null,
                500L, "Historia X", 0);
        when(workItemService.findById(501L, 1L)).thenReturn(response);

        mockMvc.perform(get("/api/work-items/501").principal(authenticatedAs(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentWorkItemId").value(500))
                .andExpect(jsonPath("$.parentWorkItemTitle").value("Historia X"))
                .andExpect(jsonPath("$.childCount").value(0));
    }

    @Test
    void deleteReturns409WhenItemStillHasChildren() throws Exception {
        org.mockito.Mockito.doThrow(new com.flowpilot.exception.WorkItemHasChildrenException(3))
                .when(workItemService).delete(500L, 1L);

        mockMvc.perform(delete("/api/work-items/500").principal(authenticatedAs(1L)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(
                        "No se puede eliminar: la tarea tiene 3 subtareas."));
    }

    @Test
    void updateWithInvalidParentReturns400() throws Exception {
        when(workItemService.update(eq(500L), any(WorkItemUpdateRequest.class), eq(1L)))
                .thenThrow(new com.flowpilot.exception.InvalidParentException(
                        "Una tarea no puede ser su propia tarea padre"));

        mockMvc.perform(put("/api/work-items/500")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new WorkItemUpdateRequest("X", null, null))))
                .andExpect(status().isBadRequest());
    }

    private WorkItemResponse workItemResponse(Long id, Long projectId, Long columnId, String title, int position) {
        OffsetDateTime now = OffsetDateTime.now();
        return new WorkItemResponse(id, projectId, columnId, title, null, null, null, position, now, now);
    }

    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
