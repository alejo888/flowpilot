package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedRiskAdvice;
import com.flowpilot.dto.RiskAnalysisResponse;
import com.flowpilot.dto.RiskSeverity;
import com.flowpilot.dto.RiskSignalResponse;
import com.flowpilot.dto.RiskSignalType;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.SprintRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.repository.WorkItemRepository;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.entity.WorkItemPriority;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Thin authorization wrapper for the hybrid risk analysis (vision 7.6):
 * project-exists (404) -> {@code canView} (403) -> deterministic signals ->
 * AI summary/recommendations. With no signals the AI is never called.
 */
@ExtendWith(MockitoExtension.class)
class AiRiskAnalysisServiceTest {

    private static final long PROJECT_ID = 10L;
    private static final long CALLER_ID = 7L;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Mock
    private WorkItemRepository workItemRepository;

    @Mock
    private BoardColumnRepository boardColumnRepository;

    @Mock
    private SprintRepository sprintRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectRiskDetector detector;

    @Mock
    private AiPlanningService aiPlanningService;

    private AiRiskAnalysisService service;

    /** Bookkeeping-only transaction manager: real synchronization state, no resources. */
    private static final class FakeTransactionManager extends AbstractPlatformTransactionManager {
        int begun;

        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
            begun++;
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {}

        @Override
        protected void doRollback(DefaultTransactionStatus status) {}
    }

    private final FakeTransactionManager txManager = new FakeTransactionManager();

    @BeforeEach
    void setUp() {
        service = new AiRiskAnalysisService(
                projectRepository,
                authorizationService,
                workItemRepository,
                boardColumnRepository,
                sprintRepository,
                userRepository,
                detector,
                aiPlanningService,
                txManager);
    }

    private static RiskSignalResponse signal() {
        return new RiskSignalResponse(
                RiskSignalType.UNASSIGNED_HIGH_PRIORITY,
                RiskSeverity.HIGH,
                "Tarea urgente sin responsable",
                "\"Login\" es URGENT y no tiene responsable.",
                55L,
                null);
    }

    private void stubProjectLoads() {
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
    }

    @Test
    void raises404WhenProjectMissingBeforeAnyOtherLookup() {
        when(projectRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> service.analyze(99L, CALLER_ID)).isInstanceOf(ProjectNotFoundException.class);
        verifyNoInteractions(authorizationService, workItemRepository, detector, aiPlanningService);
    }

    @Test
    void raises403WhenCallerCannotViewTheProjectAndNeverLoadsDataOrCallsTheSeam() {
        stubProjectLoads();
        when(authorizationService.canView(CALLER_ID, PROJECT_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.analyze(PROJECT_ID, CALLER_ID)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(workItemRepository, detector, aiPlanningService);
    }

    @Test
    void withSignalsCallsTheSeamWithAContextBuiltFromThemAndReturnsBoth() {
        stubProjectLoads();
        when(authorizationService.canView(CALLER_ID, PROJECT_ID)).thenReturn(true);
        RiskSignalResponse s = signal();
        when(detector.detect(any(), any(), any(), any())).thenReturn(List.of(s));
        when(aiPlanningService.analyzeRisks(any()))
                .thenReturn(new GeneratedRiskAdvice("Hay un riesgo alto.", List.of("Asignar la tarea"), AiProvider.OLLAMA, "llama3"));

        RiskAnalysisResponse result = service.analyze(PROJECT_ID, CALLER_ID);

        assertThat(result.signals()).containsExactly(s);
        assertThat(result.summary()).isEqualTo("Hay un riesgo alto.");
        assertThat(result.recommendations()).containsExactly("Asignar la tarea");
        assertThat(result.generatedBy()).isEqualTo(AiProvider.OLLAMA);
        assertThat(result.model()).isEqualTo("llama3");

        ArgumentCaptor<String> context = ArgumentCaptor.forClass(String.class);
        verify(aiPlanningService).analyzeRisks(context.capture());
        assertThat(context.getValue()).contains("Tarea urgente sin responsable").contains("ALTA");
    }

    @Test
    void withNoSignalsSkipsTheAiAndReturnsAFixedStubShapedResult() {
        stubProjectLoads();
        when(authorizationService.canView(CALLER_ID, PROJECT_ID)).thenReturn(true);
        when(detector.detect(any(), any(), any(), any())).thenReturn(List.of());

        RiskAnalysisResponse result = service.analyze(PROJECT_ID, CALLER_ID);

        assertThat(result.signals()).isEmpty();
        assertThat(result.summary()).isEqualTo("No se detectaron riesgos.");
        assertThat(result.recommendations()).isEmpty();
        assertThat(result.generatedBy()).isEqualTo(AiProvider.STUB);
        assertThat(result.model()).isNull();
        verify(aiPlanningService, never()).analyzeRisks(any());
    }

    @Test
    void loadsAndDetectsInsideAReadOnlyTransactionButCallsTheAiOutsideAnyTransaction() {
        stubProjectLoads();
        when(authorizationService.canView(CALLER_ID, PROJECT_ID)).thenReturn(true);
        List<Boolean> detectorInTx = new ArrayList<>();
        List<Boolean> aiInTx = new ArrayList<>();
        when(detector.detect(any(), any(), any(), any())).thenAnswer(inv -> {
            detectorInTx.add(TransactionSynchronizationManager.isActualTransactionActive()
                    && TransactionSynchronizationManager.isCurrentTransactionReadOnly());
            return List.of(signal());
        });
        when(aiPlanningService.analyzeRisks(any())).thenAnswer(inv -> {
            aiInTx.add(TransactionSynchronizationManager.isActualTransactionActive());
            return new GeneratedRiskAdvice("ok", List.of("r"), AiProvider.STUB, null);
        });

        service.analyze(PROJECT_ID, CALLER_ID);

        assertThat(detectorInTx).containsExactly(true);
        assertThat(aiInTx).containsExactly(false);
        assertThat(txManager.begun).isEqualTo(1);
    }

    private static WorkItem assigned(Long assignee) {
        return new WorkItem(PROJECT_ID, 1L, "t", null, assignee, 1);
    }

    private static User user(long id, String name) {
        User u = new User(name, name + "@x.com", "h", GlobalRole.MIEMBRO_EQUIPO, true);
        try {
            var f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(u, id);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
        return u;
    }

    @Test
    void collectsDistinctNonNullAssigneeIdsAndPassesTheIdToNameMapToTheDetector() {
        stubProjectLoads();
        when(authorizationService.canView(CALLER_ID, PROJECT_ID)).thenReturn(true);
        when(workItemRepository.findByProjectIdOrderByColumnIdAscPositionAsc(PROJECT_ID))
                .thenReturn(List.of(assigned(5L), assigned(5L), assigned(null)));
        when(userRepository.findAllById(anyIterable())).thenReturn(List.of(user(5L, "Ana")));
        when(detector.detect(any(), any(), any(), any())).thenReturn(List.of());

        service.analyze(PROJECT_ID, CALLER_ID);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<Long>> ids = ArgumentCaptor.forClass(Iterable.class);
        verify(userRepository).findAllById(ids.capture());
        assertThat(ids.getValue()).containsExactly(5L);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<Long, String>> names = ArgumentCaptor.forClass(Map.class);
        verify(detector).detect(any(), any(), any(), names.capture());
        assertThat(names.getValue()).containsExactly(Map.entry(5L, "Ana"));
    }

    @Test
    void overloadedMemberSignalReadsTheUserNameAndFallsBackToUsuarioIdForUnknownIds() {
        service = new AiRiskAnalysisService(
                projectRepository,
                authorizationService,
                workItemRepository,
                boardColumnRepository,
                sprintRepository,
                userRepository,
                new ProjectRiskDetector(),
                aiPlanningService,
                txManager);
        stubProjectLoads();
        when(authorizationService.canView(CALLER_ID, PROJECT_ID)).thenReturn(true);
        List<WorkItem> items = new ArrayList<>();
        for (int i = 0; i < ProjectRiskDetector.OVERLOADED_MIN_OPEN; i++) {
            items.add(assigned(5L));
            items.add(assigned(6L));
        }
        when(workItemRepository.findByProjectIdOrderByColumnIdAscPositionAsc(PROJECT_ID)).thenReturn(items);
        when(userRepository.findAllById(anyIterable())).thenReturn(List.of(user(5L, "Ana")));
        when(aiPlanningService.analyzeRisks(any()))
                .thenReturn(new GeneratedRiskAdvice("s", List.of(), AiProvider.STUB, null));

        RiskAnalysisResponse result = service.analyze(PROJECT_ID, CALLER_ID);

        assertThat(result.signals())
                .extracting(RiskSignalResponse::title)
                .containsExactlyInAnyOrder("Miembro sobrecargado: Ana", "Miembro sobrecargado: usuario #6");
    }
}
