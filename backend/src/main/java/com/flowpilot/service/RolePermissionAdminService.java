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
import com.flowpilot.exception.UnknownRolePermissionCombinationException;
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
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Admin-only permission-matrix read (spec: role-permissions). Same
 * global-role check plus activeness check ({@code caller.isActive()}) as
 * {@link AdminUserService} — a platform-wide concern, deliberately unrelated
 * to {@link ProjectAuthorizationService}, which governs project-scoped
 * writes. The activeness check matters because access tokens stay valid for
 * their full lifetime regardless of DB state, so a just-deactivated
 * Administrador could otherwise keep reading and rewriting the matrix until
 * their token expired.
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
                    "Mover una tarea entre columnas del tablero"),
            new RolePermissionCatalogEntry(
                    Permission.COMMENT_CREATE, "Crear comentarios",
                    "Crear comentarios en proyectos y tareas"));

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

    /**
     * {@code REPEATABLE_READ} so the grant list and {@code MAX(updated_at)}
     * come from one consistent snapshot — under the default {@code
     * READ_COMMITTED} each statement could otherwise see a different commit,
     * handing the client a torn snapshot (old grants paired with a fresh
     * timestamp) that later defeats {@link #replaceAll}'s own concurrency
     * guard.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
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
     * is dense; rows are never inserted or deleted). Row-locks
     * (PESSIMISTIC_WRITE) every row before the concurrency check, so a
     * concurrent caller can no longer read the same pre-write {@code
     * MAX(updated_at)} and silently clobber this write. Evicts {@link
     * ProjectAuthorizationService}'s in-process cache only after commit, so a
     * rollback can never leave the cache reflecting grants that were never
     * persisted.
     */
    @Transactional
    public RolePermissionMatrixResponse replaceAll(Long callerId, RolePermissionUpdateRequest request) {
        requireAdmin(callerId);

        // Row-lock every grant first: this serializes concurrent replaceAll
        // callers, so a second caller blocks here until the first commits,
        // then computes `persisted` from data that already reflects the
        // first write — the stale-timestamp guard below can no longer be
        // raced past by two callers reading the same MAX(updated_at).
        Map<String, RolePermission> byKey = new HashMap<>();
        OffsetDateTime persisted = null;
        for (RolePermission row : rolePermissionRepository.findAllForUpdate()) {
            byKey.put(key(row.getRole(), row.getPermission()), row);
            if (persisted == null || row.getUpdatedAt().isAfter(persisted)) {
                persisted = row.getUpdatedAt();
            }
        }
        if (!Objects.equals(persisted, request.expectedUpdatedAt())) {
            throw new RolePermissionConcurrencyException();
        }

        for (RolePermissionGrant grant : request.grants()) {
            RolePermission row = byKey.get(key(grant.role(), grant.permission()));
            if (row == null) {
                throw new UnknownRolePermissionCombinationException(grant.role(), grant.permission());
            }
            row.setGranted(grant.granted());
            row.setUpdatedBy(callerId);
        }

        rolePermissionRepository.saveAll(byKey.values());

        // Deferred to after commit: reloading the cache from inside this
        // still-open transaction would let a later rollback leave the
        // process-wide authorization cache reflecting grants that were
        // never actually persisted.
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    projectAuthorizationService.reloadCache();
                }
            });
        } else {
            projectAuthorizationService.reloadCache();
        }

        return getMatrix(callerId);
    }

    private static String key(ProjectRole role, Permission permission) {
        return role.name() + ":" + permission.name();
    }

    private void requireAdmin(Long callerId) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new UserNotFoundException(callerId));
        if (caller.getRole() != GlobalRole.ADMINISTRADOR || !caller.isActive()) {
            throw new AccessDeniedException("Se requiere el rol de administrador");
        }
    }
}
