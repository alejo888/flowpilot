package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.User;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.UserRepository;
import java.lang.reflect.Field;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Interim owner rule (design's {@code ProjectAuthorizationService} pseudocode,
 * steps 1-2 only): global admin bypass, then owner short-circuit. Step 3
 * (ProjectMember lookup) and step 4 (matrix cache) do not exist until slices
 * 4 and 8a; every other case denies for now (spec: project-management,
 * "Edit without permission" scenario).
 */
@ExtendWith(MockitoExtension.class)
class ProjectAuthorizationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    private ProjectAuthorizationService authorizationService;

    private void setUp() {
        authorizationService =
                new ProjectAuthorizationService(userRepository, projectRepository, projectMemberRepository);
    }

    @Test
    void ownerCanEditOwnProject() throws Exception {
        setUp();
        User owner = user(1L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));

        boolean allowed = authorizationService.isOwnerOrAdmin(1L, 10L);

        assertThat(allowed).isTrue();
    }

    @Test
    void nonOwnerNonAdminCannotEdit() throws Exception {
        setUp();
        User other = user(2L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(2L)).thenReturn(Optional.of(other));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));

        boolean allowed = authorizationService.isOwnerOrAdmin(2L, 10L);

        assertThat(allowed).isFalse();
    }

    @Test
    void globalAdminBypassesOwnerCheck() throws Exception {
        setUp();
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));

        boolean allowed = authorizationService.isOwnerOrAdmin(3L, 10L);

        assertThat(allowed).isTrue();
    }

    @Test
    void throwsProjectNotFoundWhenProjectMissing() throws Exception {
        setUp();
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO);
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        try {
            authorizationService.isOwnerOrAdmin(2L, 99L);
            throw new AssertionError("expected ProjectNotFoundException");
        } catch (ProjectNotFoundException expected) {
            assertThat(expected.getMessage()).contains("99");
        }
    }

    @Test
    void ownerCanView() throws Exception {
        setUp();
        User owner = user(1L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));

        assertThat(authorizationService.canView(1L, 10L)).isTrue();
    }

    @Test
    void adminCanViewWithoutBeingAMember() throws Exception {
        setUp();
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));

        assertThat(authorizationService.canView(3L, 10L)).isTrue();
    }

    @Test
    void projectMemberCanView() throws Exception {
        setUp();
        User member = user(4L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(4L)).thenReturn(Optional.of(member));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 4L)).thenReturn(true);

        assertThat(authorizationService.canView(4L, 10L)).isTrue();
    }

    @Test
    void nonMemberNonOwnerNonAdminCannotView() throws Exception {
        setUp();
        User outsider = user(5L, GlobalRole.MIEMBRO_EQUIPO);
        Project project = project(10L, 1L);
        when(userRepository.findById(5L)).thenReturn(Optional.of(outsider));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(projectMemberRepository.existsByProjectIdAndUserId(10L, 5L)).thenReturn(false);

        assertThat(authorizationService.canView(5L, 10L)).isFalse();
    }

    private User user(Long id, GlobalRole role) throws Exception {
        User user = new User("Name", "user" + id + "@flowpilot.local", "hash", role, true);
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
