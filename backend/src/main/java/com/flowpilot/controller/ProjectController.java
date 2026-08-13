package com.flowpilot.controller;

import com.flowpilot.dto.BoardColumnResponse;
import com.flowpilot.dto.ProjectCreateRequest;
import com.flowpilot.dto.ProjectResponse;
import com.flowpilot.dto.ProjectStatusUpdateRequest;
import com.flowpilot.dto.ProjectUpdateRequest;
import com.flowpilot.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
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

    @Operation(summary = "List projects visible to the caller")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Projects"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping
    public List<ProjectResponse> list(Authentication authentication) {
        return projectService.list(currentUserId(authentication));
    }

    @Operation(summary = "Create a project")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Project created, 4 BoardColumns seeded"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(@Valid @RequestBody ProjectCreateRequest request, Authentication authentication) {
        return projectService.create(request, currentUserId(authentication));
    }

    @Operation(summary = "Get a project by id")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Project found"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner, an administrator, or a member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/{id}")
    public ProjectResponse getById(@PathVariable Long id, Authentication authentication) {
        return projectService.findById(id, currentUserId(authentication));
    }

    @Operation(summary = "Update a project's name/description")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Project updated"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner or an administrator",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PutMapping("/{id}")
    public ProjectResponse update(
            @PathVariable Long id,
            @Valid @RequestBody ProjectUpdateRequest request,
            Authentication authentication) {
        return projectService.update(id, request, currentUserId(authentication));
    }

    @Operation(summary = "Transition a project's lifecycle status")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Status updated"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner or an administrator",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PatchMapping("/{id}/status")
    public ProjectResponse updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody ProjectStatusUpdateRequest request,
            Authentication authentication) {
        return projectService.updateStatus(id, request, currentUserId(authentication));
    }

    @Operation(summary = "Delete a project")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Project deleted"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner or an administrator",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Authentication authentication) {
        projectService.delete(id, currentUserId(authentication));
    }

    @Operation(summary = "List a project's Kanban columns, ordered by position")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Board columns ordered by position"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner, an administrator, or a member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/{id}/board-columns")
    public List<BoardColumnResponse> boardColumns(@PathVariable Long id, Authentication authentication) {
        return projectService.listBoardColumns(id, currentUserId(authentication));
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
