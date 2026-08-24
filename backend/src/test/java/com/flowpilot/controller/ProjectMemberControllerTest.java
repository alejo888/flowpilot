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
import com.flowpilot.dto.ProjectMemberAddRequest;
import com.flowpilot.dto.ProjectMemberResponse;
import com.flowpilot.dto.ProjectMemberRoleUpdateRequest;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.exception.DuplicateMemberException;
import com.flowpilot.exception.GlobalExceptionHandler;
import com.flowpilot.exception.SelfRoleChangeException;
import com.flowpilot.service.ProjectMemberService;
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
class ProjectMemberControllerTest {

    @Mock
    private ProjectMemberService projectMemberService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        ProjectMemberController controller = new ProjectMemberController(projectMemberService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void addMemberReturns201() throws Exception {
        ProjectMemberResponse response = memberResponse(1L, 10L, 20L, ProjectRole.DEVELOPER);
        when(projectMemberService.addMember(eq(10L), any(ProjectMemberAddRequest.class), eq(1L)))
                .thenReturn(response);

        mockMvc.perform(post("/api/projects/10/members")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(20))
                .andExpect(jsonPath("$.role").value("DEVELOPER"));
    }

    @Test
    void addMemberWithoutPermissionReturns403() throws Exception {
        when(projectMemberService.addMember(eq(10L), any(ProjectMemberAddRequest.class), eq(2L)))
                .thenThrow(new AccessDeniedException("Not the project owner or an administrator"));

        mockMvc.perform(post("/api/projects/10/members")
                        .principal(authenticatedAs(2L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER))))
                .andExpect(status().isForbidden());
    }

    @Test
    void addDuplicateMemberReturns409() throws Exception {
        when(projectMemberService.addMember(eq(10L), any(ProjectMemberAddRequest.class), eq(1L)))
                .thenThrow(new DuplicateMemberException(10L, 20L));

        mockMvc.perform(post("/api/projects/10/members")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER))))
                .andExpect(status().isConflict());
    }

    @Test
    void changeRoleReturns200WithUpdatedRoleAndUnchangedJoinedAt() throws Exception {
        OffsetDateTime joinedAt = OffsetDateTime.now().minusDays(3);
        ProjectMemberResponse response =
                new ProjectMemberResponse(1L, 10L, 20L, ProjectRole.PROJECT_MANAGER, joinedAt);
        when(projectMemberService.changeRole(eq(10L), eq(20L), any(ProjectMemberRoleUpdateRequest.class), eq(1L)))
                .thenReturn(response);

        mockMvc.perform(put("/api/projects/10/members/20")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new ProjectMemberRoleUpdateRequest(ProjectRole.PROJECT_MANAGER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("PROJECT_MANAGER"));
    }

    @Test
    void changeOwnRoleReturns403() throws Exception {
        when(projectMemberService.changeRole(eq(10L), eq(1L), any(ProjectMemberRoleUpdateRequest.class), eq(1L)))
                .thenThrow(new SelfRoleChangeException());

        mockMvc.perform(put("/api/projects/10/members/1")
                        .principal(authenticatedAs(1L))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new ProjectMemberRoleUpdateRequest(ProjectRole.PROJECT_MANAGER))))
                .andExpect(status().isForbidden());
    }

    @Test
    void removeMemberWithoutPermissionReturns403() throws Exception {
        org.mockito.Mockito.doThrow(new AccessDeniedException("Not the project owner or an administrator"))
                .when(projectMemberService).removeMember(10L, 20L, 2L);

        mockMvc.perform(delete("/api/projects/10/members/20").principal(authenticatedAs(2L)))
                .andExpect(status().isForbidden());

        verify(projectMemberService).removeMember(10L, 20L, 2L);
    }

    @Test
    void removeMemberReturns204() throws Exception {
        mockMvc.perform(delete("/api/projects/10/members/20").principal(authenticatedAs(1L)))
                .andExpect(status().isNoContent());

        verify(projectMemberService).removeMember(10L, 20L, 1L);
    }

    @Test
    void listMembersReturnsRoster() throws Exception {
        when(projectMemberService.listMembers(10L, 1L)).thenReturn(List.of(
                memberResponse(1L, 10L, 20L, ProjectRole.DEVELOPER),
                memberResponse(2L, 10L, 21L, ProjectRole.QA)));

        mockMvc.perform(get("/api/projects/10/members").principal(authenticatedAs(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].userId").value(20));
    }

    @Test
    void listMembersWithoutPermissionReturns403() throws Exception {
        when(projectMemberService.listMembers(10L, 2L))
                .thenThrow(new AccessDeniedException("Not authorized to view members of this project"));

        mockMvc.perform(get("/api/projects/10/members").principal(authenticatedAs(2L)))
                .andExpect(status().isForbidden());
    }

    private ProjectMemberResponse memberResponse(Long id, Long projectId, Long userId, ProjectRole role) {
        return new ProjectMemberResponse(id, projectId, userId, role, OffsetDateTime.now());
    }

    private UsernamePasswordAuthenticationToken authenticatedAs(Long userId) {
        return new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of());
    }
}
