package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.RolePermissionGrant;
import com.flowpilot.dto.RolePermissionMatrixResponse;
import com.flowpilot.dto.RolePermissionUpdateRequest;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.entity.RolePermission;
import com.flowpilot.entity.User;
import com.flowpilot.exception.RolePermissionConcurrencyException;
import com.flowpilot.repository.RolePermissionRepository;
import com.flowpilot.repository.UserRepository;
import java.lang.reflect.Field;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

/**
 * Admin-only matrix read/write (spec: role-permissions, "Get matrix" /
 * "Non-admin matrix access" / "Bulk update success" / "Concurrent
 * conflicting edit" scenarios). Slice 8a shipped {@code GET}; slice 8b adds
 * the bulk atomic {@code PUT} — optimistic concurrency via {@code
 * expectedUpdatedAt} and {@link ProjectAuthorizationService#reloadCache()}.
 */
@ExtendWith(MockitoExtension.class)
class RolePermissionAdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RolePermissionRepository rolePermissionRepository;

    @Mock
    private ProjectAuthorizationService projectAuthorizationService;

    private RolePermissionAdminService service;

    private void setUp() {
        service = new RolePermissionAdminService(
                userRepository, rolePermissionRepository, projectAuthorizationService);
    }

    @Test
    void nonAdminCallerIsDenied() throws Exception {
        setUp();
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO);
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> service.getMatrix(2L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void adminGetsFullMatrixWithCatalogAndUpdatedAt() throws Exception {
        setUp();
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        OffsetDateTime updatedAt = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        RolePermission row = new RolePermission(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));
        when(rolePermissionRepository.findAll()).thenReturn(List.of(row));
        when(rolePermissionRepository.findMaxUpdatedAt()).thenReturn(Optional.of(updatedAt));

        RolePermissionMatrixResponse response = service.getMatrix(3L);

        assertThat(response.roles()).containsExactly(ProjectRole.values());
        assertThat(response.permissions()).hasSize(Permission.values().length);
        assertThat(response.grants()).extracting(
                com.flowpilot.dto.RolePermissionGrant::role,
                com.flowpilot.dto.RolePermissionGrant::permission,
                com.flowpilot.dto.RolePermissionGrant::granted)
                .containsExactly(org.assertj.core.groups.Tuple.tuple(
                        ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true));
        assertThat(response.updatedAt()).isEqualTo(updatedAt);
    }

    @Test
    void nonAdminCallerIsDeniedOnReplaceAll() throws Exception {
        setUp();
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO);
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));
        RolePermissionUpdateRequest request = new RolePermissionUpdateRequest(
                List.of(new RolePermissionGrant(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)), null);

        assertThatThrownBy(() -> service.replaceAll(2L, request)).isInstanceOf(AccessDeniedException.class);
        verify(rolePermissionRepository, never()).findAllForUpdate();
    }

    @Test
    void staleExpectedUpdatedAtThrowsConcurrencyExceptionWithNoPartialApply() throws Exception {
        setUp();
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        OffsetDateTime persisted = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        OffsetDateTime stale = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        RolePermission row = rowWithUpdatedAt(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, false, persisted);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));
        when(rolePermissionRepository.findAllForUpdate()).thenReturn(List.of(row));
        RolePermissionUpdateRequest request = new RolePermissionUpdateRequest(
                List.of(new RolePermissionGrant(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)), stale);

        assertThatThrownBy(() -> service.replaceAll(3L, request))
                .isInstanceOf(RolePermissionConcurrencyException.class);

        verify(rolePermissionRepository, never()).saveAll(anyIterable());
        verify(projectAuthorizationService, never()).reloadCache();
    }

    @Test
    void expectedUpdatedAtWithADifferentOffsetButTheSameInstantIsNotAConcurrencyConflict() throws Exception {
        // OffsetDateTime.equals() (what Objects.equals used to use) also compares
        // the UTC offset, so a client-echoed timestamp re-serialized with a
        // different-but-equivalent offset than the persisted value would
        // previously trigger a spurious 409 even though the instant is identical.
        setUp();
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        OffsetDateTime persisted = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        OffsetDateTime sameInstantDifferentOffset = OffsetDateTime.parse("2026-02-01T01:00:00+01:00");
        RolePermission row = rowWithUpdatedAt(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, false, persisted);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));
        when(rolePermissionRepository.findAllForUpdate()).thenReturn(List.of(row));
        when(rolePermissionRepository.findAll()).thenReturn(List.of(row));
        when(rolePermissionRepository.findMaxUpdatedAt()).thenReturn(Optional.of(persisted));
        RolePermissionUpdateRequest request = new RolePermissionUpdateRequest(
                List.of(new RolePermissionGrant(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)),
                sameInstantDifferentOffset);

        RolePermissionMatrixResponse response = service.replaceAll(3L, request);

        assertThat(row.isGranted()).isTrue();
        verify(rolePermissionRepository, times(1)).saveAll(anyIterable());
        verify(projectAuthorizationService, times(1)).reloadCache();
        assertThat(response.grants()).extracting(RolePermissionGrant::granted).containsExactly(true);
    }

    @Test
    void bulkReplaceUpdatesGrantsReloadsCacheAndReturnsFreshMatrix() throws Exception {
        setUp();
        User admin = user(3L, GlobalRole.ADMINISTRADOR);
        OffsetDateTime persisted = OffsetDateTime.parse("2026-02-01T00:00:00Z");
        RolePermission row = rowWithUpdatedAt(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, false, persisted);
        when(userRepository.findById(3L)).thenReturn(Optional.of(admin));
        when(rolePermissionRepository.findAllForUpdate()).thenReturn(List.of(row));
        when(rolePermissionRepository.findAll()).thenReturn(List.of(row));
        when(rolePermissionRepository.findMaxUpdatedAt()).thenReturn(Optional.of(persisted));
        RolePermissionUpdateRequest request = new RolePermissionUpdateRequest(
                List.of(new RolePermissionGrant(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)), persisted);

        RolePermissionMatrixResponse response = service.replaceAll(3L, request);

        assertThat(row.isGranted()).isTrue();
        assertThat(row.getUpdatedBy()).isEqualTo(3L);
        verify(rolePermissionRepository, times(1)).saveAll(anyIterable());
        verify(projectAuthorizationService, times(1)).reloadCache();
        assertThat(response.grants()).extracting(RolePermissionGrant::granted).containsExactly(true);
    }

    @Test
    void deactivatedAdministradorIsDeniedOnGetMatrix() throws Exception {
        setUp();
        User deactivatedAdmin = user(4L, GlobalRole.ADMINISTRADOR, false);
        when(userRepository.findById(4L)).thenReturn(Optional.of(deactivatedAdmin));

        assertThatThrownBy(() -> service.getMatrix(4L)).isInstanceOf(AccessDeniedException.class);

        verify(rolePermissionRepository, never()).findAll();
    }

    @Test
    void deactivatedAdministradorIsDeniedOnReplaceAll() throws Exception {
        setUp();
        User deactivatedAdmin = user(4L, GlobalRole.ADMINISTRADOR, false);
        when(userRepository.findById(4L)).thenReturn(Optional.of(deactivatedAdmin));
        RolePermissionUpdateRequest request = new RolePermissionUpdateRequest(
                List.of(new RolePermissionGrant(ProjectRole.PROJECT_MANAGER, Permission.MEMBER_ADD, true)), null);

        assertThatThrownBy(() -> service.replaceAll(4L, request)).isInstanceOf(AccessDeniedException.class);

        verify(rolePermissionRepository, never()).findAllForUpdate();
        verify(rolePermissionRepository, never()).saveAll(anyIterable());
        verify(projectAuthorizationService, never()).reloadCache();
    }

    private User user(Long id, GlobalRole role) throws Exception {
        return user(id, role, true);
    }

    private User user(Long id, GlobalRole role, boolean active) throws Exception {
        User user = new User("Name", "user" + id + "@flowpilot.local", "hash", role, active);
        Field field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }

    private RolePermission rowWithUpdatedAt(
            ProjectRole role, Permission permission, boolean granted, OffsetDateTime updatedAt) throws Exception {
        RolePermission row = new RolePermission(role, permission, granted);
        Field field = RolePermission.class.getDeclaredField("updatedAt");
        field.setAccessible(true);
        field.set(row, updatedAt);
        return row;
    }
}
