package com.flowpilot.controller;

import com.flowpilot.dto.WorkItemCreateRequest;
import com.flowpilot.dto.WorkItemMoveRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.dto.WorkItemUpdateRequest;
import com.flowpilot.service.BoardService;
import com.flowpilot.service.WorkItemService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * WorkItem CRUD + move endpoints (spec: work-items, kanban-board). Create/list
 * are nested under a project ({@code /api/projects/{projectId}/work-items});
 * read/update/delete/move address a single item directly ({@code
 * /api/work-items/{id}}) since a {@code WorkItem} already carries its own
 * {@code projectId}. Writes require the caller to be any project member —
 * see {@link WorkItemService}/{@link BoardService} javadoc. The move endpoint
 * ({@code PUT /api/work-items/{id}/move}) delegates to {@link BoardService},
 * which owns the gap-based positioning and cross-project-column validation
 * (design D10).
 */
@RestController
public class WorkItemController {

    private final WorkItemService workItemService;
    private final BoardService boardService;

    public WorkItemController(WorkItemService workItemService, BoardService boardService) {
        this.workItemService = workItemService;
        this.boardService = boardService;
    }

    @Operation(summary = "Create a work item")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Work item created in the project's first column"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner, an administrator, or a member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping("/api/projects/{projectId}/work-items")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkItemResponse create(
            @PathVariable Long projectId,
            @Valid @RequestBody WorkItemCreateRequest request,
            Authentication authentication) {
        return workItemService.create(projectId, request, currentUserId(authentication));
    }

    @Operation(summary = "List a project's work items")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Work items, ordered by column then within-column position"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner, an administrator, or a member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/api/projects/{projectId}/work-items")
    public List<WorkItemResponse> list(@PathVariable Long projectId, Authentication authentication) {
        return workItemService.list(projectId, currentUserId(authentication));
    }

    @Operation(summary = "Get a work item by id")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Work item found"),
        @ApiResponse(
                responseCode = "403",
                description = "Caller is not the owner, an administrator, or a member of the parent project",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No work item with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/api/work-items/{id}")
    public WorkItemResponse getById(@PathVariable Long id, Authentication authentication) {
        return workItemService.findById(id, currentUserId(authentication));
    }

    @Operation(summary = "Update a work item's title/description/assignee")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Work item updated"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner, an administrator, or a member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No work item with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PutMapping("/api/work-items/{id}")
    public WorkItemResponse update(
            @PathVariable Long id, @Valid @RequestBody WorkItemUpdateRequest request, Authentication authentication) {
        return workItemService.update(id, request, currentUserId(authentication));
    }

    @Operation(summary = "Delete a work item")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Work item deleted"),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner, an administrator, or a member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No work item with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409",
                description = "The work item still has subtasks; the detail names the exact child count",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @DeleteMapping("/api/work-items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Authentication authentication) {
        workItemService.delete(id, currentUserId(authentication));
    }

    @Operation(summary = "Move a work item to a column and/or position")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Work item moved; columnId and position persisted. "
                + "affectedItems is populated only when the target column's siblings were re-sequenced."),
        @ApiResponse(responseCode = "400", description = "columnId belongs to a different project",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not the owner, an administrator, or a member",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No work item or no target column with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PutMapping("/api/work-items/{id}/move")
    public WorkItemResponse move(
            @PathVariable Long id, @Valid @RequestBody WorkItemMoveRequest request, Authentication authentication) {
        return boardService.move(id, request, currentUserId(authentication));
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
