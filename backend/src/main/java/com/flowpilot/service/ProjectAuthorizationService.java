package com.flowpilot.service;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.User;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
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
 * Step 4 (matrix cache, slice 8a) does not exist yet — the full {@code
 * hasPermission(userId, projectId, Permission)} signature from the design
 * lands in slice 8a without touching this class's steps 1-2. Every
 * slice-3-through-6 write caller uses this simplified {@code isOwnerOrAdmin}
 * form since {@code Permission} does not exist until slice 8a.
 *
 * <p>{@link #canView} implements design's read-gate ({@code canRead = admin
 * || owner || member}) now that {@code ProjectMember} exists (slice 4). It
 * closes the read-authorization gap flagged in the slice-3 verify report:
 * {@code GET /api/projects/{id}} and {@code GET
 * /api/projects/{id}/board-columns} previously had no ownership/membership
 * check at all.
 */
@Service
public class ProjectAuthorizationService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public ProjectAuthorizationService(
            UserRepository userRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
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

    /**
     * Read gate: admin OR owner OR a live {@code ProjectMember} of the
     * project (design's {@code canRead} formula, now fully implementable
     * since {@code ProjectMember} exists).
     */
    public boolean canView(Long userId, Long projectId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        if (user.getRole() == GlobalRole.ADMINISTRADOR) {
            return true;
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));
        if (project.getOwnerId().equals(userId)) {
            return true;
        }

        return projectMemberRepository.existsByProjectIdAndUserId(projectId, userId);
    }
}
