package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import com.flowpilot.dto.UserStoryDraft;
import com.flowpilot.entity.Permission;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.ProjectRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

/**
 * Thin authorization wrapper (spec: ai-user-story-generation — "Permission
 * denied", "Project not found"; design: authz lives in a {@code @Service},
 * never the controller). Guards {@code WORKITEM_CREATE} then delegates to the
 * wired {@link AiPlanningService}; persists nothing.
 */
@ExtendWith(MockitoExtension.class)
class AiUserStoryServiceTest {

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Mock
    private AiPlanningService aiPlanningService;

    @Mock
    private ProjectRepository projectRepository;

    private AiUserStoryService service;

    @BeforeEach
    void setUp() {
        service = new AiUserStoryService(authorizationService, aiPlanningService, projectRepository);
    }

    @Test
    void delegatesToThePlannerWhenTheCallerHasWorkitemCreate() {
        when(projectRepository.existsById(10L)).thenReturn(true);
        when(authorizationService.hasPermission(1L, 10L, Permission.WORKITEM_CREATE)).thenReturn(true);
        GeneratedUserStoryResponse draft = new GeneratedUserStoryResponse(
                new UserStoryDraft("usuario", "hacer algo", "obtener valor", "Como usuario quiero hacer algo para obtener valor"),
                List.of("Un criterio"), AiProvider.STUB, null);
        when(aiPlanningService.generateUserStory("Necesito exportar")).thenReturn(draft);

        GeneratedUserStoryResponse result = service.generate(10L, "Necesito exportar", 1L);

        assertThat(result).isSameAs(draft);
        verify(aiPlanningService).generateUserStory("Necesito exportar");
    }

    @Test
    void deniesAndNeverCallsThePlannerWhenTheCallerLacksWorkitemCreate() {
        when(projectRepository.existsById(10L)).thenReturn(true);
        when(authorizationService.hasPermission(2L, 10L, Permission.WORKITEM_CREATE)).thenReturn(false);

        assertThatThrownBy(() -> service.generate(10L, "Necesito exportar", 2L))
                .isInstanceOf(AccessDeniedException.class);
        verify(aiPlanningService, never()).generateUserStory(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void raises404WhenTheProjectDoesNotExistRegardlessOfCaller() {
        when(projectRepository.existsById(999L)).thenReturn(false);

        assertThatThrownBy(() -> service.generate(999L, "Necesito exportar", 1L))
                .isInstanceOf(ProjectNotFoundException.class);
        verifyNoInteractions(aiPlanningService);
    }
}
