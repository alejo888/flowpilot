package com.flowpilot.service;

import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import com.flowpilot.exception.LastAdministratorException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.UserRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin-only user management (spec: user-administration). The authorization
 * check here is a global-role check ({@code caller.role ==
 * GlobalRole.ADMINISTRADOR}) — a platform-wide concern, deliberately
 * unrelated to {@link ProjectAuthorizationService}, which governs
 * project-scoped writes only.
 *
 * <p>Self-deactivation and self-role-change ARE allowed (deviating from the
 * design doc's Cross-Cutting note, which said to reject them outright) —
 * confirmed default: an admin retains platform access via global reach, so
 * blanket self-action rejection isn't needed. The only guard is {@link
 * #assertNotLastActiveAdmin}, which also covers the self-action case: the
 * last active Administrador can never deactivate or demote themselves either,
 * because that guard fires regardless of whether the caller and the target
 * are the same user.
 */
@Service
public class AdminUserService {

    private final UserRepository userRepository;

    public AdminUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<UserAdminResponse> listUsers(Long callerId) {
        requireAdmin(callerId);
        return userRepository.findAll().stream().map(AdminUserService::toResponse).toList();
    }

    /**
     * Activates or deactivates {@code targetId}. Deactivating a currently
     * active Administrador runs the last-Administrador lockout guard first;
     * deactivating a non-admin, or reactivating anyone, never reduces the
     * active-Administrador count, so both skip the guard entirely.
     */
    @Transactional
    public UserAdminResponse setStatus(Long callerId, Long targetId, boolean active) {
        requireAdmin(callerId);
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new UserNotFoundException(targetId));

        if (!active && target.getRole() == GlobalRole.ADMINISTRADOR) {
            assertNotLastActiveAdmin(targetId);
        }

        target.setActive(active);
        return toResponse(userRepository.save(target));
    }

    /**
     * Changes {@code targetId}'s global role. Runs the last-Administrador
     * guard only when the target is currently an active Administrador being
     * moved away from that role — any other transition cannot reduce the
     * active-Administrador count.
     */
    @Transactional
    public UserAdminResponse changeRole(Long callerId, Long targetId, GlobalRole role) {
        requireAdmin(callerId);
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new UserNotFoundException(targetId));

        if (target.getRole() == GlobalRole.ADMINISTRADOR && role != GlobalRole.ADMINISTRADOR) {
            assertNotLastActiveAdmin(targetId);
        }

        target.setRole(role);
        return toResponse(userRepository.save(target));
    }

    private void requireAdmin(Long callerId) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new UserNotFoundException(callerId));
        if (caller.getRole() != GlobalRole.ADMINISTRADOR) {
            throw new AccessDeniedException("Se requiere el rol de administrador");
        }
    }

    /**
     * Row-locks all active Administradores (PESSIMISTIC_WRITE via {@link
     * UserRepository#findActiveAdministradoresForUpdate()}) and rejects the
     * operation if {@code targetId} is the only one remaining — prevents two
     * concurrent requests from both passing a naive count check.
     */
    private void assertNotLastActiveAdmin(Long targetId) {
        List<User> activeAdmins = userRepository.findActiveAdministradoresForUpdate();
        long remaining = activeAdmins.stream().filter(u -> !u.getId().equals(targetId)).count();
        if (remaining == 0) {
            throw new LastAdministratorException();
        }
    }

    private static UserAdminResponse toResponse(User user) {
        return new UserAdminResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.isActive());
    }
}
