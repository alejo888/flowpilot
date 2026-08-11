package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.BoardColumnResponse;
import com.flowpilot.dto.ProjectCreateRequest;
import com.flowpilot.dto.ProjectResponse;
import com.flowpilot.dto.ProjectStatusUpdateRequest;
import com.flowpilot.dto.ProjectUpdateRequest;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.ProjectStatus;
import com.flowpilot.entity.User;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.UserRepository;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private BoardColumnRepository boardColumnRepository;

    @Mock
    private UserRepository userRepository;

    private ProjectAuthorizationService authorizationService;

    private ProjectService projectService;

    @BeforeEach
    void setUp() {
        authorizationService = mock(ProjectAuthorizationService.class);
        projectService = new ProjectService(
                projectRepository, boardColumnRepository, userRepository, authorizationService);
    }

    @Test
    void createSeedsFourBoardColumnsAtomically() throws Exception {
        Project saved = project(10L, 1L);
        when(projectRepository.save(any(Project.class))).thenReturn(saved);

        ProjectResponse response = projectService.create(new ProjectCreateRequest("Apollo", "desc"), 1L);

        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.ownerId()).isEqualTo(1L);
        assertThat(response.status()).isEqualTo(ProjectStatus.PLANIFICACION);

        ArgumentCaptor<BoardColumn> captor = ArgumentCaptor.forClass(BoardColumn.class);
        verify(boardColumnRepository, times(4)).save(captor.capture());
        List<BoardColumn> columns = captor.getAllValues();
        assertThat(columns).extracting(BoardColumn::getName)
                .containsExactly("Por hacer", "En progreso", "En revisión", "Terminado");
        assertThat(columns).extracting(BoardColumn::getPosition)
                .containsExactly(1024, 2048, 3072, 4096);
        assertThat(columns).allSatisfy(c -> assertThat(c.getProjectId()).isEqualTo(10L));
    }

    @Test
    void updateWithoutPermissionThrows403() throws Exception {
        when(authorizationService.hasPermission(2L, 10L, Permission.PROJECT_EDIT_SETTINGS)).thenReturn(false);

        assertThatThrownBy(() -> projectService.update(10L, new ProjectUpdateRequest("New", "desc"), 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void updateWithPermissionSucceeds() throws Exception {
        Project existing = project(10L, 1L);
        when(authorizationService.hasPermission(1L, 10L, Permission.PROJECT_EDIT_SETTINGS)).thenReturn(true);
        when(projectRepository.findById(10L)).thenReturn(Optional.of(existing));

        ProjectResponse response = projectService.update(10L, new ProjectUpdateRequest("Renamed", "new desc"), 1L);

        assertThat(response.name()).isEqualTo("Renamed");
        assertThat(response.description()).isEqualTo("new desc");
    }

    @Test
    void statusTransitionByAuthorizedUserSucceeds() throws Exception {
        Project existing = project(10L, 1L);
        when(authorizationService.hasPermission(1L, 10L, Permission.PROJECT_EDIT_SETTINGS)).thenReturn(true);
        when(projectRepository.findById(10L)).thenReturn(Optional.of(existing));

        ProjectResponse response = projectService.updateStatus(
                10L, new ProjectStatusUpdateRequest(ProjectStatus.ACTIVO), 1L);

        assertThat(response.status()).isEqualTo(ProjectStatus.ACTIVO);
    }

    @Test
    void deleteWithoutPermissionThrows403() throws Exception {
        when(authorizationService.hasPermission(2L, 10L, Permission.PROJECT_DELETE)).thenReturn(false);

        assertThatThrownBy(() -> projectService.delete(10L, 2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void deleteWithPermissionRemovesProject() throws Exception {
        Project existing = project(10L, 1L);
        when(authorizationService.hasPermission(1L, 10L, Permission.PROJECT_DELETE)).thenReturn(true);
        when(projectRepository.findById(10L)).thenReturn(Optional.of(existing));

        projectService.delete(10L, 1L);

        verify(projectRepository).delete(existing);
    }

    @Test
    void listBoardColumnsReturnsOrderedByPosition() throws Exception {
        when(authorizationService.canView(1L, 10L)).thenReturn(true);
        when(boardColumnRepository.findByProjectIdOrderByPositionAsc(10L)).thenReturn(List.of(
                new BoardColumn(10L, "Por hacer", 1024),
                new BoardColumn(10L, "En progreso", 2048)));

        List<BoardColumnResponse> result = projectService.listBoardColumns(10L, 1L);

        assertThat(result).extracting(BoardColumnResponse::name)
                .containsExactly("Por hacer", "En progreso");
    }

    @Test
    void listBoardColumnsThrows404WhenProjectMissing() {
        when(authorizationService.canView(1L, 99L)).thenThrow(new ProjectNotFoundException(99L));

        assertThatThrownBy(() -> projectService.listBoardColumns(99L, 1L))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    @Test
    void listBoardColumnsWithoutViewPermissionThrows403() {
        when(authorizationService.canView(99L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> projectService.listBoardColumns(10L, 99L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void findByIdReturnsProjectForAuthorizedViewer() throws Exception {
        when(authorizationService.canView(1L, 10L)).thenReturn(true);
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project(10L, 1L)));

        ProjectResponse response = projectService.findById(10L, 1L);

        assertThat(response.id()).isEqualTo(10L);
    }

    @Test
    void findByIdWithoutViewPermissionThrows403() {
        when(authorizationService.canView(99L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> projectService.findById(10L, 99L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void findByIdThrows404WhenProjectMissing() {
        when(authorizationService.canView(1L, 99L)).thenThrow(new ProjectNotFoundException(99L));

        assertThatThrownBy(() -> projectService.findById(99L, 1L))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    @Test
    void listReturnsOnlyOwnedProjectsForNonAdmin() throws Exception {
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO);
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));
        when(projectRepository.findByOwnerId(2L)).thenReturn(List.of(project(11L, 2L)));

        List<ProjectResponse> result = projectService.list(2L);

        assertThat(result).extracting(ProjectResponse::id).containsExactly(11L);
    }

    @Test
    void listReturnsAllProjectsForAdmin() throws Exception {
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));
        when(projectRepository.findAll()).thenReturn(List.of(project(11L, 2L), project(12L, 5L)));

        List<ProjectResponse> result = projectService.list(3L);

        assertThat(result).extracting(ProjectResponse::id).containsExactly(11L, 12L);
    }

    private Project project(Long id, Long ownerId) throws Exception {
        Project project = new Project("Project", "desc", ownerId);
        Field field = Project.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(project, id);
        return project;
    }

    private User user(Long id, GlobalRole role) throws Exception {
        User user = new User("Name", "user" + id + "@flowpilot.local", "hash", role, true);
        Field field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }
}
