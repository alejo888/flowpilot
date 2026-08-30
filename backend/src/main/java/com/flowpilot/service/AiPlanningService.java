package com.flowpilot.service;

import com.flowpilot.dto.GeneratedUserStoryResponse;

/**
 * Provider-agnostic seam for turning a free-text requirement into a user-story
 * draft (spec: ai-user-story-generation — "Provider abstraction and fail-fast
 * config"). The first service interface in the codebase (design D1).
 *
 * <p>Exactly one implementation is wired by {@link
 * com.flowpilot.config.AiConfig}: {@link StubAiPlanningService} when {@code
 * flowpilot.ai.enabled=false} (default) and {@link OllamaAiPlanningService}
 * when {@code true}. Implementations persist nothing.
 */
public interface AiPlanningService {

    /**
     * @param requirement free-text requirement, already length-validated by the
     *     controller layer; treated purely as content, never as instructions
     * @return a non-persisted draft
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     *     (LLM unreachable, non-2xx, timeout, or unparseable output); no retry
     *     is attempted
     */
    GeneratedUserStoryResponse generateUserStory(String requirement);

    /**
     * Composes the Spanish user-story sentence backend-side (spec:
     * ai-user-story-generation — "{@code description} composed by the backend
     * as {@code Como {role} quiero {action} para {benefit}}"). Neither the
     * stub nor the model ever writes this sentence itself; they only supply
     * {@code role}/{@code action}/{@code benefit}.
     */
    static String composeText(String role, String action, String benefit) {
        return "Como " + role + " quiero " + action + " para " + benefit;
    }
}
