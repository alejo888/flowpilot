package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.ProjectMemberAddRequest;
import com.flowpilot.dto.ProjectMemberResponse;
import com.flowpilot.dto.ProjectMemberRoleUpdateRequest;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectMember;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.exception.DuplicateMemberException;
import com.flowpilot.exception.ProjectMemberNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
import java.lang.reflect.Field;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

/**
 * Add/remove/role-change member logic (spec: project-membership). Write
 * operations funnel through {@code hasPermission} with the operation's
 * specific {@link Permission} (confirmed decision 5b, matrix-backed as of
 * slice 8a). Reads are gated by {@code canView}.
 */
@ExtendWith(MockitoExtension.class)
class ProjectMemberServiceTest {

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    private ProjectAuthorizationService authorizationService;

    private ProjectMemberService projectMemberService;

    @BeforeEach
    void setUp() {
        authorizationService = mock(ProjectAuthorizationService.class);
        projectMemberService = new ProjectMemberService(projectMemberRepository, authorizationService);
    }

    @Test
    void addMemberByAuthorizedUserSucceeds() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_ADD)).thenReturn(true);
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 20L)).thenReturn(false);
        ProjectMember saved = member(100L, 10L, 20L, ProjectRole.DEVELOPER);
        when(projectMemberRepository.save(org.mockito.ArgumentMatchers.any(ProjectMember.class)))
                .thenReturn(saved);

        ProjectMemberResponse response = projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER), 1L);

        assertThat(response.userId()).isEqualTo(20L);
        assertThat(response.role()).isEqualTo(ProjectRole.DEVELOPER);
    }

    @Test
    void addMemberByUnauthorizedUserThrows403() {
        when(authorizationService.hasPermission(2L, 10L, Permission.MEMBER_ADD)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER), 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void addDuplicateMemberThrows409() {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_ADD)).thenReturn(true);
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 20L)).thenReturn(true);

        assertThatThrownBy(() -> projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER), 1L))
                .isInstanceOf(DuplicateMemberException.class);
    }

    @Test
    void adminCanAddMemberWithoutBeingAMemberThemselves() throws Exception {
        // Global admin implicit access — spec scenario "Global admin implicit access"
        when(authorizationService.hasPermission(3L, 10L, Permission.MEMBER_ADD)).thenReturn(true);
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 20L)).thenReturn(false);
        ProjectMember saved = member(101L, 10L, 20L, ProjectRole.QA);
        when(projectMemberRepository.save(org.mockito.ArgumentMatchers.any(ProjectMember.class)))
                .thenReturn(saved);

        ProjectMemberResponse response = projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(20L, ProjectRole.QA), 3L);

        assertThat(response.role()).isEqualTo(ProjectRole.QA);
    }

    @Test
    void removeMemberByAuthorizedUserSucceeds() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_REMOVE)).thenReturn(true);
        ProjectMember existing = member(100L, 10L, 20L, ProjectRole.DEVELOPER);
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 20L)).thenReturn(Optional.of(existing));

        projectMemberService.removeMember(10L, 20L, 1L);

        verify(projectMemberRepository).delete(existing);
    }

    @Test
    void removeMemberByUnauthorizedUserThrows403() {
        when(authorizationService.hasPermission(2L, 10L, Permission.MEMBER_REMOVE)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.removeMember(10L, 20L, 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void removeMissingMemberThrows404() {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_REMOVE)).thenReturn(true);
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 20L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectMemberService.removeMember(10L, 20L, 1L))
                .isInstanceOf(ProjectMemberNotFoundException.class);
    }

    @Test
    void changeRolePreservesJoinedAt() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_CHANGE_ROLE)).thenReturn(true);
        ProjectMember existing = member(100L, 10L, 20L, ProjectRole.DEVELOPER);
        OffsetDateTime originalJoinedAt = existing.getJoinedAt();
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 20L)).thenReturn(Optional.of(existing));

        ProjectMemberResponse response = projectMemberService.changeRole(
                10L, 20L, new ProjectMemberRoleUpdateRequest(ProjectRole.PROJECT_MANAGER), 1L);

        assertThat(response.role()).isEqualTo(ProjectRole.PROJECT_MANAGER);
        assertThat(response.joinedAt()).isEqualTo(originalJoinedAt);
        assertThat(existing.getRole()).isEqualTo(ProjectRole.PROJECT_MANAGER);
    }

    @Test
    void changeRoleByUnauthorizedUserThrows403() {
        when(authorizationService.hasPermission(2L, 10L, Permission.MEMBER_CHANGE_ROLE)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.changeRole(
                10L, 20L, new ProjectMemberRoleUpdateRequest(ProjectRole.QA), 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void listMembersByAuthorizedViewerSucceeds() throws Exception {
        when(authorizationService.canView(1L, 10L)).thenReturn(true);
        when(projectMemberRepository.findByProjectId(10L)).thenReturn(List.of(
                member(100L, 10L, 20L, ProjectRole.DEVELOPER),
                member(101L, 10L, 21L, ProjectRole.QA)));

        List<ProjectMemberResponse> result = projectMemberService.listMembers(10L, 1L);

        assertThat(result).extracting(ProjectMemberResponse::userId).containsExactly(20L, 21L);
    }

    @Test
    void listMembersByUnauthorizedViewerThrows403() {
        when(authorizationService.canView(2L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.listMembers(10L, 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    private ProjectMember member(Long id, Long projectId, Long userId, ProjectRole role) throws Exception {
        ProjectMember member = new ProjectMember(projectId, userId, role);
        Field field = ProjectMember.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(member, id);
        return member;
    }
}
