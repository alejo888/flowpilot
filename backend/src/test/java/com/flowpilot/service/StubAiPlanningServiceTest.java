package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedSubtasksResponse;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import org.junit.jupiter.api.Test;

/**
 * Deterministic offline generator (spec: ai-user-story-generation — "Stub
 * generation happy path"). Produces a canned {@link
 * com.flowpilot.dto.UserStoryDraft} with {@code generatedBy=STUB}, {@code
 * model=null}, a backend-composed Spanish sentence and non-empty criteria;
 * persists nothing.
 */
class StubAiPlanningServiceTest {

    private final StubAiPlanningService service = new StubAiPlanningService();

    @Test
    void marksTheDraftAsStubGeneratedWithNoModel() {
        GeneratedUserStoryResponse response = service.generateUserStory("Quiero exportar reportes en PDF");

        assertThat(response.generatedBy()).isEqualTo(AiProvider.STUB);
        assertThat(response.model()).isNull();
    }

    @Test
    void composesTheSpanishSentenceFromTheStoryParts() {
        GeneratedUserStoryResponse response = service.generateUserStory("Filtrar tareas por responsable");

        assertThat(response.userStory().role()).isNotBlank();
        assertThat(response.userStory().action()).isNotBlank();
        assertThat(response.userStory().benefit()).isNotBlank();
        assertThat(response.userStory().text())
                .isEqualTo("Como " + response.userStory().role()
                        + " quiero " + response.userStory().action()
                        + " para " + response.userStory().benefit());
        assertThat(response.userStory().text()).startsWith("Como ");
    }

    @Test
    void echoesTheRequirementIntoTheDraftAction() {
        GeneratedUserStoryResponse response = service.generateUserStory("Adjuntar archivos a un comentario");

        assertThat(response.userStory().action()).contains("Adjuntar archivos a un comentario");
    }

    @Test
    void returnsAtLeastThreeNonBlankAcceptanceCriteria() {
        GeneratedUserStoryResponse response = service.generateUserStory("Recibir notificaciones por correo");

        assertThat(response.acceptanceCriteria()).hasSizeGreaterThanOrEqualTo(3);
        assertThat(response.acceptanceCriteria()).allSatisfy(c -> assertThat(c).isNotBlank());
    }

    @Test
    void isDeterministicForTheSameRequirement() {
        GeneratedUserStoryResponse first = service.generateUserStory("Buscar proyectos archivados");
        GeneratedUserStoryResponse second = service.generateUserStory("Buscar proyectos archivados");

        assertThat(first).isEqualTo(second);
    }

    @Test
    void collapsesWhitespaceAndTrimsAnOverlongRequirementInTheAction() {
        String noisy = "  Gestionar   \n  permisos   de   equipo  ";
        GeneratedUserStoryResponse response = service.generateUserStory(noisy);

        assertThat(response.userStory().action()).isEqualTo("Gestionar permisos de equipo");
    }

    // --- generateSubtasks (spec: ai-subtask-generation — "Generate from an existing story") ---

    @Test
    void generateSubtasksReturnsThreeStubDraftsWithNoModel() {
        GeneratedSubtasksResponse response =
                service.generateSubtasks("Título: Exportar informes\nDescripción: en PDF");

        assertThat(response.generatedBy()).isEqualTo(AiProvider.STUB);
        assertThat(response.model()).isNull();
        assertThat(response.subtasks()).hasSize(3);
        assertThat(response.subtasks()).allSatisfy(s -> {
            assertThat(s.title()).isNotBlank();
            assertThat(s.description()).isNotBlank();
        });
    }

    @Test
    void generateSubtasksPrefixesTitlesWithDisenarImplementarProbarAndTheNormalisedContextHead() {
        GeneratedSubtasksResponse response =
                service.generateSubtasks("  Exportar   \n  informes  de  ventas  ");

        assertThat(response.subtasks().get(0).title()).isEqualTo("Diseñar: Exportar informes de ventas");
        assertThat(response.subtasks().get(1).title()).isEqualTo("Implementar: Exportar informes de ventas");
        assertThat(response.subtasks().get(2).title()).isEqualTo("Probar: Exportar informes de ventas");
    }

    @Test
    void generateSubtasksIsDeterministicForTheSameContext() {
        GeneratedSubtasksResponse first = service.generateSubtasks("Filtrar tareas por responsable");
        GeneratedSubtasksResponse second = service.generateSubtasks("Filtrar tareas por responsable");

        assertThat(first).isEqualTo(second);
    }
}
