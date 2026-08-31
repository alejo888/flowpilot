package com.flowpilot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.flowpilot.dto.BatchWorkItemLine;
import com.flowpilot.dto.WorkItemBatchCreateRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.exception.ProjectMemberNotFoundException;
import com.flowpilot.repository.ProjectActivityRepository;
import com.flowpilot.repository.WorkItemRepository;
import com.flowpilot.service.WorkItemService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Proves the all-or-nothing contract of {@link WorkItemService#createBatch}
 * against a real Postgres container (spec: ai-subtask-generation —
 * "Transactional batch work-item creation", "Activity feed per created
 * subtask"). A Mockito unit test cannot prove transaction rollback; this can.
 *
 * <p>The lever is a per-line {@code assignedUserId} that is not a participant
 * of the project: earlier lines save, the offending line throws {@link
 * ProjectMemberNotFoundException}, and the {@code @Transactional} boundary
 * rolls the whole batch back — {@code work_items} and {@code project_activity}
 * row counts are unchanged. Requires Docker (Testcontainers-backed), same as
 * {@link FlowpilotApplicationTests}; excluded from the Docker-less test run.
 */
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class WorkItemBatchCreateIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("flowpilot")
            .withUsername("flowpilot")
            .withPassword("flowpilot");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private WorkItemService workItemService;

    @Autowired
    private WorkItemRepository workItemRepository;

    @Autowired
    private ProjectActivityRepository projectActivityRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private long projectId() {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM projects WHERE code = 'MKTWEB'", Long.class);
    }

    private long ownerId() {
        return jdbcTemplate.queryForObject(
                "SELECT owner_id FROM projects WHERE code = 'MKTWEB'", Long.class);
    }

    private long firstColumnId(long projectId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM board_columns WHERE project_id = ? ORDER BY position ASC LIMIT 1",
                Long.class, projectId);
    }

    private long nonParticipantUserId() {
        // ana.garcia is an active MIEMBRO_EQUIPO but not a member of MKTWEB and not its owner.
        return jdbcTemplate.queryForObject(
                "SELECT id FROM users WHERE email = 'ana.garcia@flowpilot.local'", Long.class);
    }

    private static BatchWorkItemLine line(String title, Long assignedUserId) {
        return new BatchWorkItemLine(title, null, List.of(), assignedUserId, null);
    }

    @Test
    void oneInvalidLineRollsBackEveryRowAndEveryActivityEvent() {
        long projectId = projectId();
        long columnId = firstColumnId(projectId);
        long before = workItemRepository.count();
        long activityBefore = projectActivityRepository.count();

        WorkItemBatchCreateRequest request = new WorkItemBatchCreateRequest(
                columnId, null, null, true, "llama3",
                List.of(
                        line("Sub 0", null),
                        line("Sub 1", null),
                        line("Sub 2", nonParticipantUserId()), // index 2 — not a project participant
                        line("Sub 3", null),
                        line("Sub 4", null)));

        assertThatThrownBy(() -> workItemService.createBatch(projectId, request, ownerId()))
                .isInstanceOf(ProjectMemberNotFoundException.class);

        assertThat(workItemRepository.count()).isEqualTo(before);
        assertThat(projectActivityRepository.count()).isEqualTo(activityBefore);
    }

    @Test
    void aValidBatchCreatesEveryRowSequentiallyAndRecordsOneEventEach() {
        long projectId = projectId();
        long columnId = firstColumnId(projectId);
        long before = workItemRepository.count();
        long activityBefore = projectActivityRepository.count();

        WorkItemBatchCreateRequest request = new WorkItemBatchCreateRequest(
                columnId, null, null, true, "llama3",
                List.of(line("Válida A", null), line("Válida B", null), line("Válida C", null)));

        List<WorkItemResponse> created = workItemService.createBatch(projectId, request, ownerId());

        assertThat(created).hasSize(3);
        assertThat(created).extracting(WorkItemResponse::columnId).containsOnly(columnId);
        assertThat(created).extracting(WorkItemResponse::position)
                .doesNotHaveDuplicates()
                .isSorted();
        assertThat(created).allSatisfy(r -> {
            assertThat(r.aiGenerated()).isTrue();
            assertThat(r.aiModel()).isEqualTo("llama3");
        });
        assertThat(workItemRepository.count()).isEqualTo(before + 3);
        assertThat(projectActivityRepository.count()).isEqualTo(activityBefore + 3);
    }
}
