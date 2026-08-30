package com.flowpilot.controller;

import com.flowpilot.dto.GenerateUserStoryRequest;
import com.flowpilot.dto.GeneratedUserStoryResponse;
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
 * AI-assisted user-story generation (spec: ai-user-story-generation). A single
 * endpoint turns a free-text requirement into a non-persisted draft; the caller
 * edits it and confirms via {@code POST /api/projects/{projectId}/work-items}.
 *
 * <p>The controller carries no authorization logic — exactly like every other
 * slice in this codebase, the {@code WORKITEM_CREATE} permission check and the
 * project-existence guard live in {@link AiUserStoryService}. Nothing is
 * persisted here.
 */
@RestController
public class AiController {

    private final AiUserStoryService aiUserStoryService;

    public AiController(AiUserStoryService aiUserStoryService) {
        this.aiUserStoryService = aiUserStoryService;
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

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
