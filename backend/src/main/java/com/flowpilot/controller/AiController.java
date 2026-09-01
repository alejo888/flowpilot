package com.flowpilot.controller;

import com.flowpilot.dto.GenerateAcceptanceCriteriaRequest;
import com.flowpilot.dto.GenerateSubtasksRequest;
import com.flowpilot.dto.GenerateUserStoryRequest;
import com.flowpilot.dto.GeneratedAcceptanceCriteriaResponse;
import com.flowpilot.dto.GeneratedSubtasksResponse;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import com.flowpilot.service.AiAcceptanceCriteriaService;
import com.flowpilot.service.AiSubtaskService;
import com.flowpilot.service.AiUserStoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI-assisted planning (spec: ai-user-story-generation, ai-subtask-generation).
 * Turns a free-text requirement into a user-story draft, or a story into a
 * subtask breakdown — both non-persisted; the caller edits and confirms them
 * through the work-item endpoints.
 *
 * <p>The controller carries no authorization logic — exactly like every other
 * slice in this codebase, the permission checks and the project/work-item
 * existence guards live in {@link AiUserStoryService} / {@link AiSubtaskService}
 * / {@link AiAcceptanceCriteriaService} ({@code WORKITEM_CREATE} for the first
 * two, {@code WORKITEM_EDIT} for acceptance criteria — design D3). Nothing is
 * persisted here.
 */
@RestController
public class AiController {

    private final AiUserStoryService aiUserStoryService;
    private final AiSubtaskService aiSubtaskService;
    private final AiAcceptanceCriteriaService aiAcceptanceCriteriaService;

    public AiController(
            AiUserStoryService aiUserStoryService,
            AiSubtaskService aiSubtaskService,
            AiAcceptanceCriteriaService aiAcceptanceCriteriaService) {
        this.aiUserStoryService = aiUserStoryService;
        this.aiSubtaskService = aiSubtaskService;
        this.aiAcceptanceCriteriaService = aiAcceptanceCriteriaService;
    }

    @Operation(summary = "Generate a non-persisted user-story draft from a free-text requirement")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Generated draft, nothing persisted"),
        @ApiResponse(responseCode = "400", description = "requirement blank or longer than 2000 characters",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller lacks WORKITEM_CREATE on this project",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "503", description = "AI assistant unavailable; no retry is attempted",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping("/api/projects/{projectId}/ai/user-stories")
    public GeneratedUserStoryResponse generateUserStory(
            @PathVariable Long projectId,
            @Valid @RequestBody GenerateUserStoryRequest request,
            Authentication authentication) {
        return aiUserStoryService.generate(projectId, request.requirement(), currentUserId(authentication));
    }

    @Operation(summary = "Generate a non-persisted subtask breakdown from a story or pasted text")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Generated subtask drafts, nothing persisted"),
        @ApiResponse(responseCode = "400",
                description = "Not exactly one of workItemId/storyText, storyText too long, "
                        + "or the source story is itself a subtask",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller lacks WORKITEM_CREATE on this project",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id, or no such work item in it",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "503", description = "AI assistant unavailable; no retry is attempted",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping("/api/projects/{projectId}/ai/subtasks")
    public GeneratedSubtasksResponse generateSubtasks(
            @PathVariable Long projectId,
            @Valid @RequestBody GenerateSubtasksRequest request,
            Authentication authentication) {
        return aiSubtaskService.generate(projectId, request, currentUserId(authentication));
    }

    @Operation(summary = "Generate non-persisted acceptance criteria for an existing work item")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Generated criteria, nothing persisted"),
        @ApiResponse(responseCode = "400", description = "workItemId is missing",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller lacks WORKITEM_EDIT on this project",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No project with that id, or no such work item in it",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "503", description = "AI assistant unavailable; no retry is attempted",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping("/api/projects/{projectId}/ai/acceptance-criteria")
    public GeneratedAcceptanceCriteriaResponse generateAcceptanceCriteria(
            @PathVariable Long projectId,
            @Valid @RequestBody GenerateAcceptanceCriteriaRequest request,
            Authentication authentication) {
        return aiAcceptanceCriteriaService.generate(projectId, request, currentUserId(authentication));
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
