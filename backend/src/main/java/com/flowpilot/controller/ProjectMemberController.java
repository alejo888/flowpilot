package com.flowpilot.controller;

import com.flowpilot.dto.ProjectMemberAddRequest;
import com.flowpilot.dto.ProjectMemberResponse;
import com.flowpilot.dto.ProjectMemberRoleUpdateRequest;
import com.flowpilot.service.ProjectMemberService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Member add/remove/role-change endpoints (spec: project-membership). Writes
 * require the caller to be the project's owner or a global administrator —
 * same interim rule as {@link ProjectController} update/delete (confirmed
 * decision 5b). {@code GET} requires {@code canView} (admin, owner, or an
 * existing member).
 */
@RestController
@RequestMapping("/api/projects/{projectId}/members")
public class ProjectMemberController {

    private final ProjectMemberService projectMemberService;

    public ProjectMemberController(ProjectMemberService projectMemberService) {
        this.projectMemberService = projectMemberService;
    }

    @Operation(summary = "List a project's members")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Members"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner, an administrator, or a member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping
    public List<ProjectMemberResponse> list(@PathVariable Long projectId, Authentication authentication) {
        return projectMemberService.listMembers(projectId, currentUserId(authentication));
    }

    @Operation(summary = "Add a member to a project")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Member added"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner or an administrator",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "User is already a member of this project",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectMemberResponse add(
            @PathVariable Long projectId,
            @Valid @RequestBody ProjectMemberAddRequest request,
            Authentication authentication) {
        return projectMemberService.addMember(projectId, request, currentUserId(authentication));
    }

    @Operation(summary = "Change a member's role in place")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Role updated"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner or an administrator",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No such member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PutMapping("/{userId}")
    public ProjectMemberResponse changeRole(
            @PathVariable Long projectId,
            @PathVariable Long userId,
            @Valid @RequestBody ProjectMemberRoleUpdateRequest request,
            Authentication authentication) {
        return projectMemberService.changeRole(projectId, userId, request, currentUserId(authentication));
    }

    @Operation(summary = "Remove a member from a project")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Member removed"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner or an administrator",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No such member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable Long projectId, @PathVariable Long userId, Authentication authentication) {
        projectMemberService.removeMember(projectId, userId, currentUserId(authentication));
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
