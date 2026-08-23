package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.ProjectMember;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.entity.RolePermission;
import com.flowpilot.entity.User;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.RolePermissionRepository;
import com.flowpilot.repository.UserRepository;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Matrix-backed authorization (spec: role-permissions; design's {@code
 * ProjectAuthorizationService} pseudocode, all 4 steps). {@link
 * ProjectAuthorizationService#hasPermission} replaces the interim
 * owner-or-admin rule: 1) global admin bypass, 2) owner short-circuit
 * (self-lockout guard, decision 5c), 3) live {@code ProjectMember} lookup —
 * no membership denies, 4) {@code role_permissions} matrix cache lookup.
 * {@link ProjectAuthorizationService#canView} is unaffected — reads stay
 * membership-based, not permission-gated.
 */
@ExtendWith(MockitoExtension.class)
class ProjectAuthorizationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private RolePermissionRepository rolePermissionRepository;

    private ProjectAuthorizationService authorizationService;

    private void setUp(List<RolePermission> seedGrants) {
        when(rolePermissionRepository.findAll()).thenReturn(seedGrants);
        authorizationService = new ProjectAuthorizationService(
                userRepository, projectRepository, projectMemberRepository, rolePermissionRepository);
        authorizationService.reloadCache();
    }

    @Test
    void globalAdminBypassesMatrixEntirely() throws Exception {
        // Matrix denies everything for DEVELOPER, but the caller is a global admin.
        setUp(List.of(rolePermission(ProjectRole.DEVELOPER, Permission.WORKITEM_CREATE, false)));
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));

        boolean allowed = authorizationService.hasPermission(3L, 10L, Permission.WORKITEM_CREATE);

        assertThat(allowed).isTrue();
    }

    @Test
    void ownerShortCircuitsEvenWithZeroGrantsInMatrix() throws Exception {
        // Owner short-circuit (decision 5c): a project can never become
        // unmanageable by mis-editing the grid, even if the owner's own
        // membership role (if any) has zero grants.
        setUp(List.of(rolePermission(ProjectRole.DEVELOPER, Permission.PROJECT_DELETE, false)));
        User owner = user(1L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));

        boolean allowed = authorizationService.hasPermission(1L, 10L, Permission.PROJECT_DELETE);

        assertThat(allowed).isTrue();
    }

    @Test
    void memberWithGrantedPermissionIsAllowed() throws Exception {
        setUp(List.of(rolePermission(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)));
        User member = user(4L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(4L)).thenReturn(Optional.of(member));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 4L))
                .thenReturn(Optional.of(new ProjectMember(10L, 4L, ProjectRole.PROJECT_MANAGER)));

        boolean allowed = authorizationService.hasPermission(4L, 10L, Permission.MEMBER_ADD);

        assertThat(allowed).isTrue();
    }

    @Test
    void memberWithoutGrantedPermissionIsDenied() throws Exception {
        setUp(List.of(rolePermission(ProjectRole.DEVELOPER, Permission.MEMBER_ADD, false)));
        User member = user(4L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(4L)).thenReturn(Optional.of(member));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 4L))
                .thenReturn(Optional.of(new ProjectMember(10L, 4L, ProjectRole.DEVELOPER)));

        boolean allowed = authorizationService.hasPermission(4L, 10L, Permission.MEMBER_ADD);

        assertThat(allowed).isFalse();
    }

    @Test
    void nonMemberNonOwnerNonAdminIsDenied() throws Exception {
        setUp(List.of(rolePermission(ProjectRole.PROJECT_MANAGER, Permission.WORKITEM_CREATE, true)));
        User outsider = user(5L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(5L)).thenReturn(Optional.of(outsider));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 5L)).thenReturn(Optional.empty());

        boolean allowed = authorizationService.hasPermission(5L, 10L, Permission.WORKITEM_CREATE);

        assertThat(allowed).isFalse();
    }

    @Test
    void throwsProjectNotFoundWhenProjectMissing() throws Exception {
        setUp(List.of());
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO);
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        try {
            authorizationService.hasPermission(2L, 99L, Permission.WORKITEM_CREATE);
            throw new AssertionError("expected ProjectNotFoundException");
        } catch (ProjectNotFoundException expected) {
            assertThat(expected.getMessage()).contains("99");
        }
    }

    @Test
    void reloadCachePicksUpNewGrantsWithoutRestart() throws Exception {
        // Simulates the 8b admin write path: an initial all-deny load, then a
        // reload after a matrix write, without recreating the service.
        setUp(List.of(rolePermission(ProjectRole.DEVELOPER, Permission.MEMBER_ADD, false)));
        User member = user(4L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(4L)).thenReturn(Optional.of(member));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 4L))
                .thenReturn(Optional.of(new ProjectMember(10L, 4L, ProjectRole.DEVELOPER)));
        assertThat(authorizationService.hasPermission(4L, 10L, Permission.MEMBER_ADD)).isFalse();

        when(rolePermissionRepository.findAll())
                .thenReturn(List.of(rolePermission(ProjectRole.DEVELOPER, Permission.MEMBER_ADD, true)));
        authorizationService.reloadCache();

        assertThat(authorizationService.hasPermission(4L, 10L, Permission.MEMBER_ADD)).isTrue();
    }

    @Test
    void ownerCanView() throws Exception {
        setUp(List.of());
        User owner = user(1L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));

        assertThat(authorizationService.canView(1L, 10L)).isTrue();
    }

    @Test
    void adminCanViewWithoutBeingAMember() throws Exception {
        setUp(List.of());
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));

        assertThat(authorizationService.canView(3L, 10L)).isTrue();
    }

    @Test
    void projectMemberCanView() throws Exception {
        setUp(List.of());
        User member = user(4L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(4L)).thenReturn(Optional.of(member));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 4L)).thenReturn(true);

        assertThat(authorizationService.canView(4L, 10L)).isTrue();
    }

    @Test
    void nonMemberNonOwnerNonAdminCannotView() throws Exception {
        setUp(List.of());
        User outsider = user(5L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(5L)).thenReturn(Optional.of(outsider));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 5L)).thenReturn(false);

        assertThat(authorizationService.canView(5L, 10L)).isFalse();
    }

    @Test
    void deactivatedAdminIsDeniedByHasPermissionAndCanView() throws Exception {
        // A deactivated caller's already-issued JWT must not keep granting
        // project-scoped authority, not even through the global-admin bypass.
        setUp(List.of(rolePermission(ProjectRole.DEVELOPER, Permission.WORKITEM_CREATE, true)));
        User admin = inactiveUser(3L, GlobalRole.ADMINISTRADOR);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));

        assertThat(authorizationService.hasPermission(3L, 10L, Permission.WORKITEM_CREATE)).isFalse();
        assertThat(authorizationService.canView(3L, 10L)).isFalse();
    }

    @Test
    void deactivatedOwnerIsDeniedByHasPermissionAndCanView() throws Exception {
        setUp(List.of());
        User owner = inactiveUser(1L, GlobalRole.MIEMBRO_EQUIPO);
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));

        assertThat(authorizationService.hasPermission(1L, 10L, Permission.PROJECT_DELETE)).isFalse();
        assertThat(authorizationService.canView(1L, 10L)).isFalse();
    }

    @Test
    void deactivatedProjectMemberIsDeniedByHasPermissionAndCanView() throws Exception {
        setUp(List.of(rolePermission(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)));
        User member = inactiveUser(4L, GlobalRole.MIEMBRO_EQUIPO);
        when(userRepository.findById(4L)).thenReturn(Optional.of(member));

        assertThat(authorizationService.hasPermission(4L, 10L, Permission.MEMBER_ADD)).isFalse();
        assertThat(authorizationService.canView(4L, 10L)).isFalse();
    }

    private RolePermission rolePermission(ProjectRole role, Permission permission, boolean granted) {
        return new RolePermission(role, permission, granted);
    }

    private User user(Long id, GlobalRole role) throws Exception {
        User user = new User("Name", "user" + id + "@flowpilot.local", "hash", role, true);
        setId(user, User.class, id);
        return user;
    }

    private User inactiveUser(Long id, GlobalRole role) throws Exception {
        User user = new User("Name", "user" + id + "@flowpilot.local", "hash", role, false);
        setId(user, User.class, id);
        return user;
    }

    private Project project(Long id, Long ownerId) throws Exception {
        Project project = new Project("Project", "desc", ownerId);
        setId(project, Project.class, id);
        return project;
    }

    private void setId(Object target, Class<?> type, Long id) throws Exception {
        Field field = type.getDeclaredField("id");
        field.setAccessible(true);
        field.set(target, id);
    }
}
