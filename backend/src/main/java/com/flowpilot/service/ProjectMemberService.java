package com.flowpilot.service;

import com.flowpilot.dto.ProjectMemberAddRequest;
import com.flowpilot.dto.ProjectMemberResponse;
import com.flowpilot.dto.ProjectMemberRoleUpdateRequest;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.ProjectMember;
import com.flowpilot.entity.User;
import com.flowpilot.exception.DuplicateMemberException;
import com.flowpilot.exception.ProjectMemberNotFoundException;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.SelfRoleChangeException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.UserRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Member add/remove/role-change (spec: project-membership). Writes funnel
 * through {@link ProjectAuthorizationService#hasPermission}: {@code
 * addMember} requires {@link Permission#MEMBER_ADD}, {@code removeMember}
 * requires {@link Permission#MEMBER_REMOVE}, {@code changeRole} requires
 * {@link Permission#MEMBER_CHANGE_ROLE} (proposal's Permission Catalog
 * table; slice 8a, matrix-backed, confirmed decision 5b). Listing is gated
 * by {@code canView} (admin, owner, or an existing member may see the
 * roster) — unaffected, reads stay membership-based.
 *
 * <p>Every write also explicitly verifies the project exists ({@link
 * #requireProjectExists}) rather than relying only on {@code
 * ProjectAuthorizationService}'s incidental project lookup — that lookup is
 * skipped entirely for a global-admin caller (the admin bypass short-circuits
 * before touching the project), which previously let an admin's request
 * against a nonexistent project silently succeed with an empty/misleading
 * result instead of 404.
 */
@Service
public class ProjectMemberService {

    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectAuthorizationService authorizationService;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectActivityService activityService;

    public ProjectMemberService(
            ProjectMemberRepository projectMemberRepository,
            ProjectAuthorizationService authorizationService,
            ProjectRepository projectRepository,
            UserRepository userRepository,
            ProjectActivityService activityService) {
        this.projectMemberRepository = projectMemberRepository;
        this.authorizationService = authorizationService;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.activityService = activityService;
    }

    @Transactional
    public ProjectMemberResponse addMember(Long projectId, ProjectMemberAddRequest request, Long requesterId) {
        requirePermission(requesterId, projectId, Permission.MEMBER_ADD);
        requireProjectExists(projectId);
        User target = userRepository.findById(request.userId())
                .orElseThrow(() -> new UserNotFoundException(request.userId()));
        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, request.userId())) {
            throw new DuplicateMemberException(projectId, request.userId());
        }
        ProjectMember saved = projectMemberRepository.save(
                new ProjectMember(projectId, request.userId(), request.role()));
        activityService.record(projectId, requesterId, ActivityEventType.MEMBER_ADDED,
                "Se agregó a " + target.getName() + " como " + request.role(), "{}");
        return toResponse(saved);
    }

    @Transactional
    public void removeMember(Long projectId, Long userId, Long requesterId) {
        requirePermission(requesterId, projectId, Permission.MEMBER_REMOVE);
        requireProjectExists(projectId);
        ProjectMember member = getOrThrow(projectId, userId);
        activityService.record(projectId, requesterId, ActivityEventType.MEMBER_REMOVED,
                "Se quitó a " + memberDisplayName(userId) + " del proyecto", "{}");
        projectMemberRepository.delete(member);
    }

    @Transactional
    public ProjectMemberResponse changeRole(
            Long projectId, Long userId, ProjectMemberRoleUpdateRequest request, Long requesterId) {
        if (userId.equals(requesterId)) {
            throw new SelfRoleChangeException();
        }
        requirePermission(requesterId, projectId, Permission.MEMBER_CHANGE_ROLE);
        requireProjectExists(projectId);
        ProjectMember member = getOrThrow(projectId, userId);
        member.setRole(request.role());
        activityService.record(projectId, requesterId, ActivityEventType.MEMBER_ROLE_CHANGED,
                "Se cambió el rol de " + memberDisplayName(userId) + " a " + request.role(), "{}");
        return toResponse(member);
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> listMembers(Long projectId, Long requesterId) {
        if (!authorizationService.canView(requesterId, projectId)) {
            throw new AccessDeniedException("No autorizado para ver los miembros de este proyecto");
        }
        requireProjectExists(projectId);
        return projectMemberRepository.findByProjectId(projectId).stream()
                .map(ProjectMemberService::toResponse)
                .toList();
    }

    private void requirePermission(Long requesterId, Long projectId, Permission permission) {
        if (!authorizationService.hasPermission(requesterId, projectId, permission)) {
            throw new AccessDeniedException("Falta el permiso " + permission + " en el proyecto " + projectId);
        }
    }

    private void requireProjectExists(Long projectId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ProjectNotFoundException(projectId);
        }
    }

    private String memberDisplayName(Long userId) {
        return userRepository.findById(userId).map(User::getName).orElse("Usuario #" + userId);
    }

    private ProjectMember getOrThrow(Long projectId, Long userId) {
        return projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new ProjectMemberNotFoundException(projectId, userId));
    }

    private static ProjectMemberResponse toResponse(ProjectMember member) {
        return new ProjectMemberResponse(
                member.getId(), member.getProjectId(), member.getUserId(), member.getRole(), member.getJoinedAt());
    }
}
