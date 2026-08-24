package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.ProjectMemberAddRequest;
import com.flowpilot.dto.ProjectMemberResponse;
import com.flowpilot.dto.ProjectMemberRoleUpdateRequest;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectMember;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.entity.User;
import com.flowpilot.exception.DuplicateMemberException;
import com.flowpilot.exception.ProjectMemberNotFoundException;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.SelfRoleChangeException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.UserRepository;
import java.lang.reflect.Field;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

/**
 * Add/remove/role-change member logic (spec: project-membership). Write
 * operations funnel through {@code hasPermission} with the operation's
 * specific {@link Permission} (confirmed decision 5b, matrix-backed as of
 * slice 8a). Reads are gated by {@code canView}. Every write also verifies
 * the project exists (JD module 5 fix) and {@code addMember} verifies the
 * target user exists; {@code changeRole} rejects a caller targeting their
 * own membership row (self-lockout guard).
 */
@ExtendWith(MockitoExtension.class)
class ProjectMemberServiceTest {

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    private ProjectAuthorizationService authorizationService;
    private ProjectActivityService activityService;

    private ProjectMemberService projectMemberService;

    @BeforeEach
    void setUp() {
        authorizationService = mock(ProjectAuthorizationService.class);
        activityService = mock(ProjectActivityService.class);
        projectMemberService = new ProjectMemberService(
                projectMemberRepository, authorizationService, projectRepository, userRepository, activityService);
    }

    @Test
    void addMemberByAuthorizedUserSucceeds() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_ADD)).thenReturn(true);
        when(projectRepository.existsById(10L)).thenReturn(true);
        when(userRepository.findById(20L)).thenReturn(Optional.of(user(20L, "Ana")));
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 20L)).thenReturn(false);
        ProjectMember saved = member(100L, 10L, 20L, ProjectRole.DEVELOPER);
        when(projectMemberRepository.save(ArgumentMatchers.any(ProjectMember.class))).thenReturn(saved);

        ProjectMemberResponse response = projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER), 1L);

        assertThat(response.userId()).isEqualTo(20L);
        assertThat(response.role()).isEqualTo(ProjectRole.DEVELOPER);
        verify(activityService).record(
                org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(com.flowpilot.entity.ActivityEventType.MEMBER_ADDED),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void addMemberByUnauthorizedUserThrows403() {
        when(authorizationService.hasPermission(2L, 10L, Permission.MEMBER_ADD)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER), 2L))
                .isInstanceOf(AccessDeniedException.class);
        verify(projectMemberRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void addMemberToMissingProjectThrows404() {
        when(authorizationService.hasPermission(1L, 99L, Permission.MEMBER_ADD)).thenReturn(true);
        when(projectRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.addMember(
                99L, new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER), 1L))
                .isInstanceOf(ProjectNotFoundException.class);
        verify(projectMemberRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void addMissingUserThrows404() {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_ADD)).thenReturn(true);
        when(projectRepository.existsById(10L)).thenReturn(true);
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(99L, ProjectRole.DEVELOPER), 1L))
                .isInstanceOf(UserNotFoundException.class);
        verify(projectMemberRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void addDuplicateMemberThrows409() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_ADD)).thenReturn(true);
        when(projectRepository.existsById(10L)).thenReturn(true);
        when(userRepository.findById(20L)).thenReturn(Optional.of(user(20L, "Ana")));
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 20L)).thenReturn(true);

        assertThatThrownBy(() -> projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(20L, ProjectRole.DEVELOPER), 1L))
                .isInstanceOf(DuplicateMemberException.class);
    }

    @Test
    void adminCanAddMemberWithoutBeingAMemberThemselves() throws Exception {
        // Global admin implicit access — spec scenario "Global admin implicit access"
        when(authorizationService.hasPermission(3L, 10L, Permission.MEMBER_ADD)).thenReturn(true);
        when(projectRepository.existsById(10L)).thenReturn(true);
        when(userRepository.findById(20L)).thenReturn(Optional.of(user(20L, "Ana")));
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 20L)).thenReturn(false);
        ProjectMember saved = member(101L, 10L, 20L, ProjectRole.QA);
        when(projectMemberRepository.save(ArgumentMatchers.any(ProjectMember.class))).thenReturn(saved);

        ProjectMemberResponse response = projectMemberService.addMember(
                10L, new ProjectMemberAddRequest(20L, ProjectRole.QA), 3L);

        assertThat(response.role()).isEqualTo(ProjectRole.QA);
    }

    @Test
    void removeMemberByAuthorizedUserSucceeds() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_REMOVE)).thenReturn(true);
        when(projectRepository.existsById(10L)).thenReturn(true);
        ProjectMember existing = member(100L, 10L, 20L, ProjectRole.DEVELOPER);
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 20L)).thenReturn(Optional.of(existing));
        when(userRepository.findById(20L)).thenReturn(Optional.of(user(20L, "Ana")));

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
    void removeMemberFromMissingProjectThrows404() {
        when(authorizationService.hasPermission(1L, 99L, Permission.MEMBER_REMOVE)).thenReturn(true);
        when(projectRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.removeMember(99L, 20L, 1L))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    @Test
    void removeMissingMemberThrows404() {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_REMOVE)).thenReturn(true);
        when(projectRepository.existsById(10L)).thenReturn(true);
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 20L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectMemberService.removeMember(10L, 20L, 1L))
                .isInstanceOf(ProjectMemberNotFoundException.class);
    }

    @Test
    void changeRolePreservesJoinedAt() throws Exception {
        when(authorizationService.hasPermission(1L, 10L, Permission.MEMBER_CHANGE_ROLE)).thenReturn(true);
        when(projectRepository.existsById(10L)).thenReturn(true);
        ProjectMember existing = member(100L, 10L, 20L, ProjectRole.DEVELOPER);
        OffsetDateTime originalJoinedAt = existing.getJoinedAt();
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 20L)).thenReturn(Optional.of(existing));
        when(userRepository.findById(20L)).thenReturn(Optional.of(user(20L, "Ana")));

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
    void changeRoleOnMissingProjectThrows404() {
        when(authorizationService.hasPermission(1L, 99L, Permission.MEMBER_CHANGE_ROLE)).thenReturn(true);
        when(projectRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.changeRole(
                99L, 20L, new ProjectMemberRoleUpdateRequest(ProjectRole.QA), 1L))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    @Test
    void changeOwnRoleThrowsSelfRoleChangeException() {
        assertThatThrownBy(() -> projectMemberService.changeRole(
                10L, 1L, new ProjectMemberRoleUpdateRequest(ProjectRole.PROJECT_MANAGER), 1L))
                .isInstanceOf(SelfRoleChangeException.class);
        verify(authorizationService, never()).hasPermission(
                ArgumentMatchers.anyLong(), ArgumentMatchers.anyLong(), ArgumentMatchers.any());
    }

    @Test
    void listMembersByAuthorizedViewerSucceeds() throws Exception {
        when(authorizationService.canView(1L, 10L)).thenReturn(true);
        when(projectRepository.existsById(10L)).thenReturn(true);
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

    @Test
    void listMembersOfMissingProjectThrows404ForAdminToo() {
        // spec/JD gap: canView's admin bypass never checks project existence,
        // so listMembers must verify it explicitly for every caller.
        when(authorizationService.canView(3L, 99L)).thenReturn(true);
        when(projectRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> projectMemberService.listMembers(99L, 3L))
                .isInstanceOf(ProjectNotFoundException.class);
        verify(projectMemberRepository, never()).findByProjectId(ArgumentMatchers.anyLong());
    }

    private ProjectMember member(Long id, Long projectId, Long userId, ProjectRole role) throws Exception {
        ProjectMember member = new ProjectMember(projectId, userId, role);
        Field field = ProjectMember.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(member, id);
        return member;
    }

    private User user(Long id, String name) throws Exception {
        User user = new User(name, "user" + id + "@flowpilot.local", "hash", GlobalRole.MIEMBRO_EQUIPO, true);
        Field field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }
}
