package com.flowpilot.service;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import com.flowpilot.dto.UserStoryDraft;
import java.util.List;

/**
 * Deterministic offline generator, active when {@code flowpilot.ai.enabled=false}
 * (spec: ai-user-story-generation — "Stub generation happy path"). Wired by
 * {@link com.flowpilot.config.AiConfig}; carries no {@code @Service}
 * annotation (design D1).
 *
 * <p>Produces a canned draft with a fixed {@code role}/{@code benefit} and an
 * {@code action} derived verbatim from the whitespace-normalised requirement,
 * so the same requirement always yields the same draft. {@code
 * generatedBy=STUB}, {@code model=null}; nothing is persisted.
 */
public class StubAiPlanningService implements AiPlanningService {

    private static final String ROLE = "usuario del equipo";
    private static final String BENEFIT = "trabajar de forma más eficiente";
    private static final int MAX_ACTION_LENGTH = 200;

    @Override
    public GeneratedUserStoryResponse generateUserStory(String requirement) {
        String action = normaliseAction(requirement);
        String text = AiPlanningService.composeText(ROLE, action, BENEFIT);
        List<String> acceptanceCriteria = List.of(
                "Dado el requisito \"" + action + "\" cuando se implemente entonces la funcionalidad queda disponible para " + ROLE,
                "Dado un caso de uso válido cuando " + ROLE + " la utiliza entonces el resultado es correcto y verificable",
                "Dado un caso inválido o incompleto cuando se intenta la acción entonces el sistema muestra un mensaje de error claro");
        return new GeneratedUserStoryResponse(
                new UserStoryDraft(ROLE, action, BENEFIT, text), acceptanceCriteria, AiProvider.STUB, null);
    }

    private static String normaliseAction(String requirement) {
        String collapsed = requirement == null ? "" : requirement.strip().replaceAll("\\s+", " ");
        if (collapsed.isEmpty()) {
            return "cumplir el requisito indicado";
        }
        if (collapsed.length() > MAX_ACTION_LENGTH) {
            return collapsed.substring(0, MAX_ACTION_LENGTH).strip();
        }
        return collapsed;
    }
}
