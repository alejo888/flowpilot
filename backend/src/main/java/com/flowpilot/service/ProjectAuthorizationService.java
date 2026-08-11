package com.flowpilot.service;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.User;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.UserRepository;
import org.springframework.stereotype.Service;

/**
 * Interim authorization seam for project-scoped writes (design's {@code
 * ProjectAuthorizationService}, steps 1-2 of the pseudocode only):
 *
 * <ol>
 *   <li>Global admin ({@link GlobalRole#ADMINISTRADOR}) bypasses everything.</li>
 *   <li>The project's owner bypasses everything (self-lockout guard).</li>
 *   <li>Everyone else is denied.</li>
 * </ol>
 *
 * Steps 3 (live {@code ProjectMember} lookup, slice 4) and 4 (matrix cache,
 * slice 8a) do not exist yet — the full {@code hasPermission(userId,
 * projectId, Permission)} signature from the design lands in slice 8a without
 * touching this class's steps 1-2. Every slice-3-through-6 caller uses this
 * simplified {@code isOwnerOrAdmin} form since {@code ProjectMember} and
 * {@code Permission} do not exist until later slices.
 */
@Service
public class ProjectAuthorizationService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;

    public ProjectAuthorizationService(UserRepository userRepository, ProjectRepository projectRepository) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
    }

    public boolean isOwnerOrAdmin(Long userId, Long projectId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        if (user.getRole() == GlobalRole.ADMINISTRADOR) {
            return true;
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));
        return project.getOwnerId().equals(userId);
    }
}
