package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GenerateSubtasksRequest;
import com.flowpilot.dto.GeneratedSubtasksResponse;
import com.flowpilot.dto.SubtaskDraft;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.InvalidParentException;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

/**
 * Thin authorization wrapper for subtask generation (spec: ai-subtask-generation
 * — "Generation authorization ordering"; design D3). Check order is project-exists
 * (404) → mode (a) work-item-exists and in-project (404) → {@code WORKITEM_CREATE}
 * (403) → source-story-is-itself-a-subtask (400) → compose context and call the
 * seam. 404 strictly before 403. Persists nothing.
 */
@ExtendWith(MockitoExtension.class)
class AiSubtaskServiceTest {

    private static final long PROJECT_ID = 10L;
    private static final long CALLER_ID = 7L;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private WorkItemRepository workItemRepository;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Mock
    private AiPlanningService aiPlanningService;

    private AiSubtaskService service;

    @BeforeEach
    void setUp() {
        service = new AiSubtaskService(
                projectRepository, workItemRepository, authorizationService, aiPlanningService);
    }

    private static WorkItem story(Long projectId, String title, String description, List<String> criteria) {
        WorkItem item = new WorkItem(projectId, 1L, title, description, null, 1024);
        item.setAcceptanceCriteria(criteria);
        return item;
    }

    private static GeneratedSubtasksResponse sampleDrafts() {
        return new GeneratedSubtasksResponse(
                List.of(new SubtaskDraft("Diseñar", "d1"), new SubtaskDraft("Implementar", "d2")),
                AiProvider.OLLAMA,
                "llama3");
    }

    @Test
    void raises404WhenProjectMissingBeforeAnyPermissionCheck() {
        when(projectRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() ->
                        service.generate(99L, new GenerateSubtasksRequest(null, "texto libre"), CALLER_ID))
                .isInstanceOf(ProjectNotFoundException.class);
        verifyNoInteractions(authorizationService, aiPlanningService);
    }

    @Test
    void raises404WhenWorkItemMissingBeforePermissionCheck() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(500L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                        service.generate(PROJECT_ID, new GenerateSubtasksRequest(500L, null), CALLER_ID))
                .isInstanceOf(WorkItemNotFoundException.class);
        verifyNoInteractions(authorizationService, aiPlanningService);
    }

    @Test
    void raises404WhenWorkItemBelongsToAnotherProject() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(500L))
                .thenReturn(Optional.of(story(999L, "Otro proyecto", null, List.of())));

        assertThatThrownBy(() ->
                        service.generate(PROJECT_ID, new GenerateSubtasksRequest(500L, null), CALLER_ID))
                .isInstanceOf(WorkItemNotFoundException.class);
        verifyNoInteractions(authorizationService, aiPlanningService);
    }

    @Test
    void raises403WhenCallerLacksWorkitemCreate() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(500L))
                .thenReturn(Optional.of(story(PROJECT_ID, "Historia", "desc", List.of())));
        when(authorizationService.hasPermission(CALLER_ID, PROJECT_ID, Permission.WORKITEM_CREATE))
                .thenReturn(false);

        assertThatThrownBy(() ->
                        service.generate(PROJECT_ID, new GenerateSubtasksRequest(500L, null), CALLER_ID))
                .isInstanceOf(AccessDeniedException.class);
        verify(aiPlanningService, never()).generateSubtasks(any());
    }

    @Test
    void raises400WhenSourceStoryIsItselfASubtask() {
        WorkItem child = story(PROJECT_ID, "Subtarea", "desc", List.of());
        child.setParentWorkItemId(42L);
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(child));
        when(authorizationService.hasPermission(CALLER_ID, PROJECT_ID, Permission.WORKITEM_CREATE))
                .thenReturn(true);

        assertThatThrownBy(() ->
                        service.generate(PROJECT_ID, new GenerateSubtasksRequest(500L, null), CALLER_ID))
                .isInstanceOf(InvalidParentException.class)
                .hasMessage("No se pueden generar subtareas de una subtarea");
        verify(aiPlanningService, never()).generateSubtasks(any());
    }

    @Test
    void modeAComposesTheStoryContextFromTitleDescriptionAndCriteriaThenCallsTheSeam() {
        WorkItem item = story(
                PROJECT_ID,
                "Exportar informes",
                "en PDF con filtros",
                List.of("El PDF respeta los filtros", "Incluye la fecha de generación"));
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(CALLER_ID, PROJECT_ID, Permission.WORKITEM_CREATE))
                .thenReturn(true);
        GeneratedSubtasksResponse drafts = sampleDrafts();
        when(aiPlanningService.generateSubtasks(any())).thenReturn(drafts);

        GeneratedSubtasksResponse result =
                service.generate(PROJECT_ID, new GenerateSubtasksRequest(500L, null), CALLER_ID);

        assertThat(result).isSameAs(drafts);
        ArgumentCaptor<String> context = ArgumentCaptor.forClass(String.class);
        verify(aiPlanningService).generateSubtasks(context.capture());
        assertThat(context.getValue())
                .isEqualTo(
                        "Título: Exportar informes\n"
                        + "Descripción: en PDF con filtros\n"
                        + "Criterios de aceptación:\n"
                        + "- El PDF respeta los filtros\n"
                        + "- Incluye la fecha de generación");
    }

    @Test
    void modeAOmitsTheCriteriaBlockAndUsesAPlaceholderDescriptionWhenBothAreEmpty() {
        WorkItem item = story(PROJECT_ID, "Historia sin detalle", null, List.of());
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(500L)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(CALLER_ID, PROJECT_ID, Permission.WORKITEM_CREATE))
                .thenReturn(true);
        when(aiPlanningService.generateSubtasks(any())).thenReturn(sampleDrafts());

        service.generate(PROJECT_ID, new GenerateSubtasksRequest(500L, null), CALLER_ID);

        ArgumentCaptor<String> context = ArgumentCaptor.forClass(String.class);
        verify(aiPlanningService).generateSubtasks(context.capture());
        assertThat(context.getValue())
                .isEqualTo("Título: Historia sin detalle\nDescripción: (sin descripción)");
        assertThat(context.getValue()).doesNotContain("Criterios de aceptación");
    }

    @Test
    void modeBPassesTheStrippedStoryTextVerbatimAndNeverTouchesWorkItems() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(authorizationService.hasPermission(CALLER_ID, PROJECT_ID, Permission.WORKITEM_CREATE))
                .thenReturn(true);
        when(aiPlanningService.generateSubtasks("texto libre del usuario")).thenReturn(sampleDrafts());

        GeneratedSubtasksResponse result = service.generate(
                PROJECT_ID, new GenerateSubtasksRequest(null, "  texto libre del usuario  "), CALLER_ID);

        assertThat(result.subtasks()).hasSize(2);
        verify(aiPlanningService).generateSubtasks("texto libre del usuario");
        verifyNoInteractions(workItemRepository);
    }
}
