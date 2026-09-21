package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedProjectDraftResponse;
import com.flowpilot.dto.ProjectDraftEpic;
import com.flowpilot.dto.ProjectDraftStory;
import com.flowpilot.exception.AiGenerationException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Thin delegate for the project draft (vision 7.4). Project creation has no
 * permission, so there is no guard: the service only hands the description to
 * the wired {@link AiPlanningService}; it persists nothing.
 */
@ExtendWith(MockitoExtension.class)
class AiProjectDraftServiceTest {

    @Mock
    private AiPlanningService aiPlanningService;

    @InjectMocks
    private AiProjectDraftService service;

    @Test
    void delegatesTheDescriptionToTheSeamAndReturnsItsDraft() {
        GeneratedProjectDraftResponse draft = new GeneratedProjectDraftResponse(
                "Tienda",
                "Una tienda",
                null,
                List.of(new ProjectDraftEpic("Catálogo", null, List.of(new ProjectDraftStory("Listar", null)))),
                AiProvider.STUB,
                null);
        when(aiPlanningService.generateProjectDraft("Una tienda")).thenReturn(draft);

        assertThat(service.generate("Una tienda")).isSameAs(draft);
    }

    @Test
    void propagatesAiGenerationFailures() {
        when(aiPlanningService.generateProjectDraft("x")).thenThrow(new AiGenerationException("boom"));

        assertThatThrownBy(() -> service.generate("x")).isInstanceOf(AiGenerationException.class);
    }
}
