package com.flowpilot.service;

import com.flowpilot.dto.GeneratedProjectDraftResponse;
import org.springframework.stereotype.Service;

/**
 * Application-layer entry point for AI project drafts (vision 7.4). Project
 * creation itself has no permission, so there is no guard here: any
 * authenticated caller (enforced by the security filter chain) may request a
 * draft. Keeps the controller free of provider knowledge; persists nothing.
 */
@Service
public class AiProjectDraftService {

    private final AiPlanningService aiPlanningService;

    public AiProjectDraftService(AiPlanningService aiPlanningService) {
        this.aiPlanningService = aiPlanningService;
    }

    /**
     * @param description free-text project description, already length-validated by the controller
     * @return a non-persisted draft
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     */
    public GeneratedProjectDraftResponse generate(String description) {
        return aiPlanningService.generateProjectDraft(description);
    }
}
