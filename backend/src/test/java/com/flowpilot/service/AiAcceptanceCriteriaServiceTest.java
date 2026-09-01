package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GenerateAcceptanceCriteriaRequest;
import com.flowpilot.dto.GeneratedAcceptanceCriteriaResponse;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.WorkItem;
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
 * Thin authorization wrapper for acceptance-criteria generation (spec:
 * ai-acceptance-criteria-generation — "Generation authorization ordering";
 * design D9). Check order is project-exists (404) → work-item-exists and
 * in-project (404, cross-project is the same 404) → {@code WORKITEM_EDIT}
 * (403) → compose context and call the seam. 404 strictly before 403. No
 * parent check (design D8): a subtask source is allowed. Persists nothing.
 */
@ExtendWith(MockitoExtension.class)
class AiAcceptanceCriteriaServiceTest {

    private static final long PROJECT_ID = 10L;
    private static final long CALLER_ID = 7L;
    private static final long WORK_ITEM_ID = 500L;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private WorkItemRepository workItemRepository;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Mock
    private AiPlanningService aiPlanningService;

    private AiAcceptanceCriteriaService service;

    @BeforeEach
    void setUp() {
        service = new AiAcceptanceCriteriaService(
                projectRepository, workItemRepository, authorizationService, aiPlanningService);
    }

    private static WorkItem story(Long projectId, String title, String description, List<String> criteria) {
        WorkItem item = new WorkItem(projectId, 1L, title, description, null, 1024);
        item.setAcceptanceCriteria(criteria);
        return item;
    }

    private static GeneratedAcceptanceCriteriaResponse sample() {
        return new GeneratedAcceptanceCriteriaResponse(
                List.of("Dado A cuando B entonces C"), AiProvider.OLLAMA, "llama3");
    }

    private static GenerateAcceptanceCriteriaRequest request() {
        return new GenerateAcceptanceCriteriaRequest(WORK_ITEM_ID);
    }

    @Test
    void raises404WhenProjectMissingBeforeAnyOtherLookup() {
        when(projectRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> service.generate(
                        99L, new GenerateAcceptanceCriteriaRequest(WORK_ITEM_ID), CALLER_ID))
                .isInstanceOf(ProjectNotFoundException.class);
        verifyNoInteractions(workItemRepository, authorizationService, aiPlanningService);
    }

    @Test
    void raises404WhenWorkItemMissingBeforePermissionCheck() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(WORK_ITEM_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generate(PROJECT_ID, request(), CALLER_ID))
                .isInstanceOf(WorkItemNotFoundException.class);
        verifyNoInteractions(authorizationService, aiPlanningService);
    }

    @Test
    void raises404WhenWorkItemBelongsToAnotherProject() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(WORK_ITEM_ID))
                .thenReturn(Optional.of(story(999L, "Otro proyecto", null, List.of())));

        assertThatThrownBy(() -> service.generate(PROJECT_ID, request(), CALLER_ID))
                .isInstanceOf(WorkItemNotFoundException.class);
        verifyNoInteractions(authorizationService, aiPlanningService);
    }

    @Test
    void raises403WhenCallerLacksWorkitemEditAndNeverCallsTheSeam() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(WORK_ITEM_ID))
                .thenReturn(Optional.of(story(PROJECT_ID, "Historia", "desc", List.of())));
        when(authorizationService.hasPermission(CALLER_ID, PROJECT_ID, Permission.WORKITEM_EDIT))
                .thenReturn(false);

        assertThatThrownBy(() -> service.generate(PROJECT_ID, request(), CALLER_ID))
                .isInstanceOf(AccessDeniedException.class);
        verify(aiPlanningService, never()).generateAcceptanceCriteria(any());
    }

    @Test
    void allowsASourceStoryThatIsItselfASubtask() {
        WorkItem child = story(PROJECT_ID, "Subtarea", "desc", List.of());
        child.setParentWorkItemId(42L);
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(WORK_ITEM_ID)).thenReturn(Optional.of(child));
        when(authorizationService.hasPermission(CALLER_ID, PROJECT_ID, Permission.WORKITEM_EDIT))
                .thenReturn(true);
        GeneratedAcceptanceCriteriaResponse drafts = sample();
        when(aiPlanningService.generateAcceptanceCriteria(any())).thenReturn(drafts);

        GeneratedAcceptanceCriteriaResponse result = service.generate(PROJECT_ID, request(), CALLER_ID);

        assertThat(result).isSameAs(drafts);
    }

    @Test
    void composesTheStoryContextFromTitleDescriptionAndCriteriaThenCallsTheSeam() {
        WorkItem item = story(
                PROJECT_ID,
                "Exportar informes",
                "en PDF con filtros",
                List.of("El PDF respeta los filtros", "Incluye la fecha de generación"));
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findById(WORK_ITEM_ID)).thenReturn(Optional.of(item));
        when(authorizationService.hasPermission(CALLER_ID, PROJECT_ID, Permission.WORKITEM_EDIT))
                .thenReturn(true);
        when(aiPlanningService.generateAcceptanceCriteria(any())).thenReturn(sample());

        service.generate(PROJECT_ID, request(), CALLER_ID);

        ArgumentCaptor<String> context = ArgumentCaptor.forClass(String.class);
        verify(aiPlanningService).generateAcceptanceCriteria(context.capture());
        assertThat(context.getValue())
                .isEqualTo(
                        "Título: Exportar informes\n"
                        + "Descripción: en PDF con filtros\n"
                        + "Criterios de aceptación:\n"
                        + "- El PDF respeta los filtros\n"
                        + "- Incluye la fecha de generación");
    }
}
