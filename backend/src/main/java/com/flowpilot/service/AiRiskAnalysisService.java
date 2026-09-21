package com.flowpilot.service;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedRiskAdvice;
import com.flowpilot.dto.RiskAnalysisResponse;
import com.flowpilot.dto.RiskSignalResponse;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.SprintRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Application-layer entry point for the hybrid AI risk analysis (vision 7.6).
 * The signals are computed deterministically by {@link ProjectRiskDetector};
 * the AI only writes a summary and recommendations over them. Authorization
 * lives here, never in the controller, and nothing is persisted.
 *
 * <p>Guarded by {@link ProjectAuthorizationService#canView} — the same read
 * gate as the dashboard, no new permission. Check order, 404 strictly before
 * 403: project exists ({@link ProjectNotFoundException}), then {@code canView}
 * ({@link AccessDeniedException}). The explicit existence check matters
 * because {@code canView} short-circuits to {@code true} for a global admin
 * before its own project lookup.
 *
 * <p>With no signals the AI is not called: the result carries a fixed
 * message, no recommendations, {@link AiProvider#STUB} and a {@code null}
 * model. STUB is the simplest consistent choice — no model produced anything.
 */
@Service
public class AiRiskAnalysisService {

    static final String NO_RISKS_SUMMARY = "No se detectaron riesgos.";

    private final ProjectRepository projectRepository;
    private final ProjectAuthorizationService authorizationService;
    private final WorkItemRepository workItemRepository;
    private final BoardColumnRepository boardColumnRepository;
    private final SprintRepository sprintRepository;
    private final UserRepository userRepository;
    private final ProjectRiskDetector detector;
    private final AiPlanningService aiPlanningService;
    private final TransactionTemplate readTx;

    public AiRiskAnalysisService(
            ProjectRepository projectRepository,
            ProjectAuthorizationService authorizationService,
            WorkItemRepository workItemRepository,
            BoardColumnRepository boardColumnRepository,
            SprintRepository sprintRepository,
            UserRepository userRepository,
            ProjectRiskDetector detector,
            AiPlanningService aiPlanningService,
            PlatformTransactionManager transactionManager) {
        this.projectRepository = projectRepository;
        this.authorizationService = authorizationService;
        this.workItemRepository = workItemRepository;
        this.boardColumnRepository = boardColumnRepository;
        this.sprintRepository = sprintRepository;
        this.userRepository = userRepository;
        this.detector = detector;
        this.aiPlanningService = aiPlanningService;
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
    }

    /**
     * Not transactional as a whole: the outbound LLM call can take up to the
     * provider read timeout, and must not hold a DB connection while it waits.
     * Only the data loading and signal detection run inside a short read-only
     * transaction ({@link #detectSignals}); everything the detector reads is
     * scalar/materialized, so nothing lazy is touched after it closes.
     *
     * @throws ProjectNotFoundException if {@code projectId} is unknown
     * @throws AccessDeniedException if the caller cannot view the project
     * @throws com.flowpilot.exception.AiGenerationException if generation fails
     */
    public RiskAnalysisResponse analyze(Long projectId, Long requesterId) {
        List<RiskSignalResponse> signals = readTx.execute(status -> detectSignals(projectId, requesterId));

        if (signals.isEmpty()) {
            return new RiskAnalysisResponse(List.of(), NO_RISKS_SUMMARY, List.of(), AiProvider.STUB, null);
        }

        GeneratedRiskAdvice advice = aiPlanningService.analyzeRisks(AiRiskContext.compose(signals));
        return new RiskAnalysisResponse(
                signals, advice.summary(), advice.recommendations(), advice.generatedBy(), advice.model());
    }

    private List<RiskSignalResponse> detectSignals(Long projectId, Long requesterId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ProjectNotFoundException(projectId);
        }
        if (!authorizationService.canView(requesterId, projectId)) {
            throw new AccessDeniedException("No autorizado para analizar los riesgos del proyecto " + projectId);
        }

        List<WorkItem> items = workItemRepository.findByProjectIdOrderByColumnIdAscPositionAsc(projectId);
        Map<Long, String> userNames = new LinkedHashMap<>();
        userRepository
                .findAllById(items.stream()
                        .map(WorkItem::getAssignedUserId)
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList())
                .forEach(u -> userNames.put(u.getId(), u.getName()));

        return detector.detect(
                items,
                boardColumnRepository.findByProjectIdOrderByPositionAsc(projectId),
                sprintRepository.findByProjectIdOrderByStartDateAsc(projectId),
                userNames);
    }
}
