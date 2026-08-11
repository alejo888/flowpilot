package com.flowpilot.controller;

import com.flowpilot.dto.BoardColumnResponse;
import com.flowpilot.dto.ProjectCreateRequest;
import com.flowpilot.dto.ProjectResponse;
import com.flowpilot.dto.ProjectStatusUpdateRequest;
import com.flowpilot.dto.ProjectUpdateRequest;
import com.flowpilot.service.ProjectService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Project CRUD + lifecycle endpoints (spec: project-management). Every write
 * requires the caller to be the project's owner or a global administrator —
 * interim rule enforced by {@link com.flowpilot.service.ProjectAuthorizationService}
 * (slices 3-6, until slice 8a's permission matrix exists). {@code GET /{id}}
 * and {@code GET /{id}/board-columns} require {@code canView} (admin, owner,
 * or a {@code ProjectMember}) — closes the read-authorization gap flagged in
 * the slice-3 verify report (previously authentication-only).
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public List<ProjectResponse> list(Authentication authentication) {
        return projectService.list(currentUserId(authentication));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(@Valid @RequestBody ProjectCreateRequest request, Authentication authentication) {
        return projectService.create(request, currentUserId(authentication));
    }

    @GetMapping("/{id}")
    public ProjectResponse getById(@PathVariable Long id, Authentication authentication) {
        return projectService.findById(id, currentUserId(authentication));
    }

    @PutMapping("/{id}")
    public ProjectResponse update(
            @PathVariable Long id,
            @Valid @RequestBody ProjectUpdateRequest request,
            Authentication authentication) {
        return projectService.update(id, request, currentUserId(authentication));
    }

    @PatchMapping("/{id}/status")
    public ProjectResponse updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody ProjectStatusUpdateRequest request,
            Authentication authentication) {
        return projectService.updateStatus(id, request, currentUserId(authentication));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Authentication authentication) {
        projectService.delete(id, currentUserId(authentication));
    }

    @GetMapping("/{id}/board-columns")
    public List<BoardColumnResponse> boardColumns(@PathVariable Long id, Authentication authentication) {
        return projectService.listBoardColumns(id, currentUserId(authentication));
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
