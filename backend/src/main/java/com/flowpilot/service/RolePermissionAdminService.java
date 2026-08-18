package com.flowpilot.service;

import com.flowpilot.dto.RolePermissionCatalogEntry;
import com.flowpilot.dto.RolePermissionGrant;
import com.flowpilot.dto.RolePermissionMatrixResponse;
import com.flowpilot.dto.RolePermissionUpdateRequest;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.entity.RolePermission;
import com.flowpilot.entity.User;
import com.flowpilot.exception.RolePermissionConcurrencyException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.RolePermissionRepository;
import com.flowpilot.repository.UserRepository;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin-only permission-matrix read (spec: role-permissions). Same
 * global-role-check pattern as {@link AdminUserService} — a platform-wide
 * concern, deliberately unrelated to {@link ProjectAuthorizationService},
 * which governs project-scoped writes.
 *
 * <p>Slice 8b adds the bulk atomic {@link #replaceAll} (per-cell grant
 * replace, optimistic concurrency via {@code expectedUpdatedAt}, and {@link
 * ProjectAuthorizationService#reloadCache()} in the same transaction — design's
 * "Matrix write" data-flow line).
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
    private final ProjectAuthorizationService projectAuthorizationService;

    public RolePermissionAdminService(
            UserRepository userRepository,
            RolePermissionRepository rolePermissionRepository,
            ProjectAuthorizationService projectAuthorizationService) {
        this.userRepository = userRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.projectAuthorizationService = projectAuthorizationService;
    }

    public RolePermissionMatrixResponse getMatrix(Long callerId) {
        requireAdmin(callerId);

        List<RolePermissionGrant> grants = rolePermissionRepository.findAll().stream()
                .map(row -> new RolePermissionGrant(row.getRole(), row.getPermission(), row.isGranted()))
                .toList();
        OffsetDateTime updatedAt = rolePermissionRepository.findMaxUpdatedAt().orElse(null);

        return new RolePermissionMatrixResponse(List.of(ProjectRole.values()), CATALOG, grants, updatedAt);
    }

    /**
     * Bulk atomic replace (spec: role-permissions, "Bulk update success" /
     * "Concurrent conflicting edit" scenarios). Rejects with {@link
     * RolePermissionConcurrencyException} (409) before touching any row if
     * {@code request.expectedUpdatedAt()} no longer matches the persisted
     * {@code MAX(updated_at)} — no partial apply. On success, flips {@code
     * granted}/{@code updatedBy} on every matching existing row (the matrix
     * is dense; rows are never inserted or deleted) and evicts {@link
     * ProjectAuthorizationService}'s in-process cache in the same
     * transaction so the new grants apply without a restart.
     */
    @Transactional
    public RolePermissionMatrixResponse replaceAll(Long callerId, RolePermissionUpdateRequest request) {
        requireAdmin(callerId);

        OffsetDateTime persisted = rolePermissionRepository.findMaxUpdatedAt().orElse(null);
        if (!Objects.equals(persisted, request.expectedUpdatedAt())) {
            throw new RolePermissionConcurrencyException();
        }

        Map<String, RolePermission> byKey = new HashMap<>();
        for (RolePermission row : rolePermissionRepository.findAll()) {
            byKey.put(key(row.getRole(), row.getPermission()), row);
        }

        for (RolePermissionGrant grant : request.grants()) {
            RolePermission row = byKey.get(key(grant.role(), grant.permission()));
            if (row == null) {
                throw new IllegalArgumentException(
                        "Unknown role/permission combination: " + grant.role() + "/" + grant.permission());
            }
            row.setGranted(grant.granted());
            row.setUpdatedBy(callerId);
        }

        rolePermissionRepository.saveAll(byKey.values());
        projectAuthorizationService.reloadCache();

        return getMatrix(callerId);
    }

    private static String key(ProjectRole role, Permission permission) {
        return role.name() + ":" + permission.name();
    }

    private void requireAdmin(Long callerId) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new UserNotFoundException(callerId));
        if (caller.getRole() != GlobalRole.ADMINISTRADOR) {
            throw new AccessDeniedException("Se requiere el rol de administrador");
        }
    }
}
