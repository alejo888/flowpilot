package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.RolePermissionMatrixResponse;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.entity.RolePermission;
import com.flowpilot.entity.User;
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
 * Admin-only matrix read (spec: role-permissions, "Get matrix" / "Non-admin
 * matrix access" scenarios). Only the {@code GET} read path exists in slice
 * 8a; the bulk {@code PUT} (optimistic concurrency, cache reload) is slice
 * 8b's scope.
 */
@ExtendWith(MockitoExtension.class)
class RolePermissionAdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RolePermissionRepository rolePermissionRepository;

    private RolePermissionAdminService service;

    private void setUp() {
        service = new RolePermissionAdminService(userRepository, rolePermissionRepository);
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

    private User user(Long id, GlobalRole role) throws Exception {
        User user = new User("Name", "user" + id + "@flowpilot.local", "hash", role, true);
        Field field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }
}
