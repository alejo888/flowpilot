package com.flowpilot.service;

import com.flowpilot.dto.ProjectMemberAddRequest;
import com.flowpilot.dto.ProjectMemberResponse;
import com.flowpilot.dto.ProjectMemberRoleUpdateRequest;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.ProjectMember;
import com.flowpilot.exception.DuplicateMemberException;
import com.flowpilot.exception.ProjectMemberNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
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
 */
@Service
public class ProjectMemberService {

    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectAuthorizationService authorizationService;
    private ProjectActivityService activityService;

    public ProjectMemberService(
            ProjectMemberRepository projectMemberRepository, ProjectAuthorizationService authorizationService) {
        this.projectMemberRepository = projectMemberRepository;
        this.authorizationService = authorizationService;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setActivityService(ProjectActivityService service) { this.activityService = service; }

    @Transactional
    public ProjectMemberResponse addMember(Long projectId, ProjectMemberAddRequest request, Long requesterId) {
        requirePermission(requesterId, projectId, Permission.MEMBER_ADD);
        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, request.userId())) {
            throw new DuplicateMemberException(projectId, request.userId());
        }
        ProjectMember saved = projectMemberRepository.save(
                new ProjectMember(projectId, request.userId(), request.role()));
            if (activityService != null) activityService.record(projectId, requesterId, ActivityEventType.MEMBER_ADDED, "Member added", "{}");
        return toResponse(saved);
    }

    @Transactional
    public void removeMember(Long projectId, Long userId, Long requesterId) {
        requirePermission(requesterId, projectId, Permission.MEMBER_REMOVE);
        ProjectMember member = getOrThrow(projectId, userId);
            if (activityService != null) activityService.record(projectId, requesterId, ActivityEventType.MEMBER_REMOVED, "Member removed", "{}");
        projectMemberRepository.delete(member);
    }

    @Transactional
    public ProjectMemberResponse changeRole(
            Long projectId, Long userId, ProjectMemberRoleUpdateRequest request, Long requesterId) {
        requirePermission(requesterId, projectId, Permission.MEMBER_CHANGE_ROLE);
        ProjectMember member = getOrThrow(projectId, userId);
        member.setRole(request.role());
            if (activityService != null) activityService.record(projectId, requesterId, ActivityEventType.MEMBER_ROLE_CHANGED, "Member role changed", "{}");
        return toResponse(member);
    }

    public List<ProjectMemberResponse> listMembers(Long projectId, Long requesterId) {
        if (!authorizationService.canView(requesterId, projectId)) {
            throw new AccessDeniedException("No autorizado para ver los miembros de este proyecto");
        }
        return projectMemberRepository.findByProjectId(projectId).stream()
                .map(ProjectMemberService::toResponse)
                .toList();
    }

    private void requirePermission(Long requesterId, Long projectId, Permission permission) {
        if (!authorizationService.hasPermission(requesterId, projectId, permission)) {
            throw new AccessDeniedException("Falta el permiso " + permission + " en el proyecto " + projectId);
        }
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
