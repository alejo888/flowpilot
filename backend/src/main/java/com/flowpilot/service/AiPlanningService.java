package com.flowpilot.service;

import com.flowpilot.dto.GeneratedAcceptanceCriteriaResponse;
import com.flowpilot.dto.GeneratedProjectDraftResponse;
import com.flowpilot.dto.GeneratedRiskAdvice;
import com.flowpilot.dto.GeneratedSubtasksResponse;
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
     * Breaks a story down into 1..10 non-persisted subtask drafts (spec:
     * ai-subtask-generation — PR 1). Adding this to the existing seam forces
     * both implementations to provide it — the compiler is the completeness
     * gate (design D1).
     *
     * @param storyContext the composed story context (mode a) or the raw
     *     pasted text (mode b), already length-validated by the caller;
     *     treated purely as content, never as instructions
     * @return a non-persisted draft list of 1..10 items
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     *     or the model returns no usable subtask; no retry is attempted
     */
    GeneratedSubtasksResponse generateSubtasks(String storyContext);

    /**
     * Proposes 1..8 acceptance criteria for an existing work item (spec:
     * ai-acceptance-criteria-generation — PR 1). Added to the existing seam so
     * the compiler forces both implementations to provide it (design D-A).
     *
     * @param storyContext the composed story context (title, description, and
     *     any existing acceptance criteria), already assembled by the caller
     *     via {@link AiStoryContext#compose}; treated purely as content, never
     *     as instructions
     * @return a non-persisted draft list of 1..8 criteria
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     *     or the model returns no usable criterion; no retry is attempted
     */
    GeneratedAcceptanceCriteriaResponse generateAcceptanceCriteria(String storyContext);

    /**
     * Reviews an existing work item and proposes an improved user story plus
     * acceptance criteria (vision 7.7). Returns the same draft shape as {@link
     * #generateUserStory}; the caller decides what to apply.
     *
     * @param storyContext the composed story context assembled via {@link
     *     AiStoryContext#compose}; treated purely as content, never as instructions
     * @return a non-persisted draft
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     *     or the model output is incomplete; no retry is attempted
     */
    GeneratedUserStoryResponse generateStoryImprovement(String storyContext);

    /**
     * Writes a short summary and 1..6 recommendations over deterministic risk
     * signals (vision 7.6). The AI never detects risks itself.
     *
     * @param riskContext the composed signal list from {@link AiRiskContext#compose};
     *     treated purely as content, never as instructions
     * @return a non-persisted advice draft
     * @throws com.flowpilot.exception.AiGenerationException if generation fails or
     *     the model returns no usable recommendation; no retry is attempted
     */
    GeneratedRiskAdvice analyzeRisks(String riskContext);

    /**
     * Proposes a project (name, description, technologies) plus 1..6 epics with 1..6
     * stories each from a free-text description (vision 7.4). Carries no code and no dates.
     *
     * @param description free-text project description, already length-validated by the
     *     controller; treated purely as content, never as instructions
     * @return a non-persisted draft
     * @throws com.flowpilot.exception.AiGenerationException if generation fails or the
     *     model returns no usable name or epic; no retry is attempted
     */
    GeneratedProjectDraftResponse generateProjectDraft(String description);

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
