package com.flowpilot.service;

import com.flowpilot.dto.RolePermissionCatalogEntry;
import com.flowpilot.dto.RolePermissionGrant;
import com.flowpilot.dto.RolePermissionMatrixResponse;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.entity.User;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.RolePermissionRepository;
import com.flowpilot.repository.UserRepository;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/**
 * Admin-only permission-matrix read (spec: role-permissions). Same
 * global-role-check pattern as {@link AdminUserService} — a platform-wide
 * concern, deliberately unrelated to {@link ProjectAuthorizationService},
 * which governs project-scoped writes.
 *
 * <p>Slice 8a scope: {@code GET} only. The bulk atomic {@code PUT} (per-cell
 * grant replace, optimistic concurrency via {@code expectedUpdatedAt}, and
 * {@link ProjectAuthorizationService}'s cache eviction) is slice 8b's scope
 * and belongs on this same class.
 */
@Service
public class RolePermissionAdminService {

    /** Fixed catalog rendering metadata (spec: role-permissions). UI copy in Spanish. */
    private static final List<RolePermissionCatalogEntry> CATALOG = List.of(
            new RolePermissionCatalogEntry(
                    Permission.PROJECT_EDIT_SETTINGS, "Editar configuración del proyecto",
                    "Modificar nombre y descripción del proyecto"),
            new RolePermissionCatalogEntry(
                    Permission.PROJECT_DELETE, "Eliminar proyecto",
                    "Eliminar el proyecto de forma permanente"),
            new RolePermissionCatalogEntry(
                    Permission.MEMBER_ADD, "Agregar miembros",
                    "Añadir un nuevo miembro al proyecto"),
            new RolePermissionCatalogEntry(
                    Permission.MEMBER_REMOVE, "Quitar miembros",
                    "Quitar un miembro del proyecto"),
            new RolePermissionCatalogEntry(
                    Permission.MEMBER_CHANGE_ROLE, "Cambiar rol de miembro",
                    "Cambiar el rol de un miembro dentro del proyecto"),
            new RolePermissionCatalogEntry(
                    Permission.WORKITEM_CREATE, "Crear tareas",
                    "Crear una nueva tarea en el proyecto"),
            new RolePermissionCatalogEntry(
                    Permission.WORKITEM_EDIT, "Editar tareas",
                    "Modificar una tarea existente"),
            new RolePermissionCatalogEntry(
                    Permission.WORKITEM_DELETE, "Eliminar tareas",
                    "Eliminar una tarea del proyecto"),
            new RolePermissionCatalogEntry(
                    Permission.WORKITEM_MOVE, "Mover tareas",
                    "Mover una tarea entre columnas del tablero"));

    private final UserRepository userRepository;
    private final RolePermissionRepository rolePermissionRepository;

    public RolePermissionAdminService(
            UserRepository userRepository, RolePermissionRepository rolePermissionRepository) {
        this.userRepository = userRepository;
        this.rolePermissionRepository = rolePermissionRepository;
    }

    public RolePermissionMatrixResponse getMatrix(Long callerId) {
        requireAdmin(callerId);

        List<RolePermissionGrant> grants = rolePermissionRepository.findAll().stream()
                .map(row -> new RolePermissionGrant(row.getRole(), row.getPermission(), row.isGranted()))
                .toList();
        OffsetDateTime updatedAt = rolePermissionRepository.findMaxUpdatedAt().orElse(null);

        return new RolePermissionMatrixResponse(List.of(ProjectRole.values()), CATALOG, grants, updatedAt);
    }

    private void requireAdmin(Long callerId) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new UserNotFoundException(callerId));
        if (caller.getRole() != GlobalRole.ADMINISTRADOR) {
            throw new AccessDeniedException("Administrator role required");
        }
    }
}
