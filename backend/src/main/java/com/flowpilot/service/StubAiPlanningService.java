package com.flowpilot.service;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedAcceptanceCriteriaResponse;
import com.flowpilot.dto.GeneratedSubtasksResponse;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import com.flowpilot.dto.SubtaskDraft;
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
    private static final int MAX_CONTEXT_HEAD_LENGTH = 180;

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

    /**
     * Deterministic 3-item breakdown (design D1): {@code Diseñar} / {@code
     * Implementar} / {@code Probar}, each embedding the whitespace-normalised
     * head of the story context, so the same context always yields the same
     * drafts. {@code generatedBy=STUB}, {@code model=null}.
     */
    @Override
    public GeneratedSubtasksResponse generateSubtasks(String storyContext) {
        String head = contextHead(storyContext);
        List<SubtaskDraft> subtasks = List.of(
                new SubtaskDraft(
                        "Diseñar: " + head,
                        "Definir el enfoque técnico y los criterios de aceptación de: " + head),
                new SubtaskDraft(
                        "Implementar: " + head,
                        "Desarrollar la funcionalidad necesaria para: " + head),
                new SubtaskDraft(
                        "Probar: " + head,
                        "Añadir pruebas automáticas que verifiquen: " + head));
        return new GeneratedSubtasksResponse(subtasks, AiProvider.STUB, null);
    }

    /**
     * Deterministic 3-item acceptance-criteria list (design D-A), each in
     * «Dado … cuando … entonces …» form and embedding the whitespace-normalised
     * head of the story context, so the same context always yields the same
     * criteria. {@code generatedBy=STUB}, {@code model=null}.
     */
    @Override
    public GeneratedAcceptanceCriteriaResponse generateAcceptanceCriteria(String storyContext) {
        String head = contextHead(storyContext);
        List<String> criteria = List.of(
                "Dado " + head + " cuando el usuario completa la acción entonces el resultado es visible y verificable",
                "Dado una entrada inválida en " + head
                        + " cuando se procesa entonces el sistema muestra un mensaje de error claro",
                "Dado un usuario sin permiso cuando intenta " + head + " entonces la acción queda bloqueada");
        return new GeneratedAcceptanceCriteriaResponse(criteria, AiProvider.STUB, null);
    }

    private static String contextHead(String storyContext) {
        String collapsed = storyContext == null ? "" : storyContext.strip().replaceAll("\\s+", " ");
        if (collapsed.isEmpty()) {
            return "la historia indicada";
        }
        if (collapsed.length() > MAX_CONTEXT_HEAD_LENGTH) {
            return collapsed.substring(0, MAX_CONTEXT_HEAD_LENGTH).strip();
        }
        return collapsed;
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
