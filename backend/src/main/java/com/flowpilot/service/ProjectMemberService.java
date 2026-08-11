package com.flowpilot.service;

import com.flowpilot.dto.ProjectMemberAddRequest;
import com.flowpilot.dto.ProjectMemberResponse;
import com.flowpilot.dto.ProjectMemberRoleUpdateRequest;
import com.flowpilot.entity.ProjectMember;
import com.flowpilot.exception.DuplicateMemberException;
import com.flowpilot.exception.ProjectMemberNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Member add/remove/role-change (spec: project-membership). Writes (add,
 * remove, role change) are gated by {@code isOwnerOrAdmin} — the same interim
 * owner-or-admin rule already used for {@code ProjectService} update/delete
 * (confirmed decision 5b). Listing is gated by {@code canView} (admin, owner,
 * or an existing member may see the roster).
 */
@Service
public class ProjectMemberService {

    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectAuthorizationService authorizationService;

    public ProjectMemberService(
            ProjectMemberRepository projectMemberRepository, ProjectAuthorizationService authorizationService) {
        this.projectMemberRepository = projectMemberRepository;
        this.authorizationService = authorizationService;
    }

    @Transactional
    public ProjectMemberResponse addMember(Long projectId, ProjectMemberAddRequest request, Long requesterId) {
        requireOwnerOrAdmin(requesterId, projectId);
        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, request.userId())) {
            throw new DuplicateMemberException(projectId, request.userId());
        }
        ProjectMember saved = projectMemberRepository.save(
                new ProjectMember(projectId, request.userId(), request.role()));
        return toResponse(saved);
    }

    @Transactional
    public void removeMember(Long projectId, Long userId, Long requesterId) {
        requireOwnerOrAdmin(requesterId, projectId);
        ProjectMember member = getOrThrow(projectId, userId);
        projectMemberRepository.delete(member);
    }

    @Transactional
    public ProjectMemberResponse changeRole(
            Long projectId, Long userId, ProjectMemberRoleUpdateRequest request, Long requesterId) {
        requireOwnerOrAdmin(requesterId, projectId);
        ProjectMember member = getOrThrow(projectId, userId);
        member.setRole(request.role());
        return toResponse(member);
    }

    public List<ProjectMemberResponse> listMembers(Long projectId, Long requesterId) {
        if (!authorizationService.canView(requesterId, projectId)) {
            throw new AccessDeniedException("Not authorized to view members of this project");
        }
        return projectMemberRepository.findByProjectId(projectId).stream()
                .map(ProjectMemberService::toResponse)
                .toList();
    }

    private void requireOwnerOrAdmin(Long requesterId, Long projectId) {
        if (!authorizationService.isOwnerOrAdmin(requesterId, projectId)) {
            throw new AccessDeniedException("Not the project owner or an administrator");
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
