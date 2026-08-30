package com.flowpilot;

import static org.assertj.core.api.Assertions.assertThat;

import com.flowpilot.entity.WorkItem;
import com.flowpilot.entity.WorkItemPriority;
import com.flowpilot.repository.WorkItemRepository;
import java.util.List;
import java.util.Map;
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
 * Pins the {@code acceptance_criteria jsonb} / {@code ai_generated} / {@code
 * ai_model} mapping added by V20 against a real Postgres container under
 * {@code spring.jpa.hibernate.ddl-auto=validate} (spec: work-items —
 * "Structured acceptance criteria", "AI provenance on confirmed create").
 *
 * <p>If Hibernate's schema validation rejects the {@link
 * com.flowpilot.entity.AcceptanceCriteriaConverter}-backed {@code String}
 * attribute against the {@code jsonb} column, the Spring context fails to
 * start and every test here errors — which is exactly the signal used to
 * decide whether {@code @JdbcTypeCode(SqlTypes.JSON)} / {@code
 * columnDefinition = "jsonb"} is required on the entity field. Requires Docker
 * (Testcontainers-backed), same as {@link FlowpilotApplicationTests}.
 */
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class WorkItemAiFieldsPersistenceIntegrationTest {

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
    private WorkItemRepository workItemRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private long[] anyProjectAndColumn() {
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT project_id, id AS column_id FROM board_columns ORDER BY id LIMIT 1");
        return new long[] {
            ((Number) row.get("project_id")).longValue(), ((Number) row.get("column_id")).longValue()
        };
    }

    @Test
    void roundTripsAcceptanceCriteriaThroughTheJsonbColumnPreservingOrderAndAccents() {
        long[] ids = anyProjectAndColumn();
        WorkItem item = new WorkItem(ids[0], ids[1], "Historia con criterios", "desc", null, 4096);
        List<String> criteria = List.of(
                "Dado un usuario con permiso \"WORKITEM_CREATE\"",
                "Cuando confirma la historia generada",
                "Entonces se crea la tarea con acentos á é í ó ú ñ");
        item.setAcceptanceCriteria(criteria);

        Long id = workItemRepository.save(item).getId();
        WorkItem reloaded = workItemRepository.findById(id).orElseThrow();

        assertThat(reloaded.getAcceptanceCriteria()).containsExactlyElementsOf(criteria);

        String stored = jdbcTemplate.queryForObject(
                "SELECT acceptance_criteria::text FROM work_items WHERE id = ?", String.class, id);
        assertThat(stored).startsWith("[").contains("WORKITEM_CREATE").contains("á é í ó ú ñ");
    }

    @Test
    void defaultsAcceptanceCriteriaToEmptyAndProvenanceToUnset() {
        long[] ids = anyProjectAndColumn();
        WorkItem item = new WorkItem(ids[0], ids[1], "Historia manual", null, null, 5120);

        Long id = workItemRepository.save(item).getId();
        WorkItem reloaded = workItemRepository.findById(id).orElseThrow();

        assertThat(reloaded.getAcceptanceCriteria()).isNotNull().isEmpty();
        assertThat(reloaded.isAiGenerated()).isFalse();
        assertThat(reloaded.getAiModel()).isNull();

        String stored = jdbcTemplate.queryForObject(
                "SELECT acceptance_criteria::text FROM work_items WHERE id = ?", String.class, id);
        assertThat(stored).isEqualTo("[]");
    }

    @Test
    void persistsAiProvenanceWhenSet() {
        long[] ids = anyProjectAndColumn();
        WorkItem item = new WorkItem(
                ids[0], ids[1], "Historia IA", "Como rol quiero accion para beneficio", null, 6144, null,
                WorkItemPriority.MEDIUM);
        item.setAcceptanceCriteria(List.of("Dado X", "Entonces Y"));
        item.setAiGenerated(true);
        item.setAiModel("llama3");

        Long id = workItemRepository.save(item).getId();
        WorkItem reloaded = workItemRepository.findById(id).orElseThrow();

        assertThat(reloaded.isAiGenerated()).isTrue();
        assertThat(reloaded.getAiModel()).isEqualTo("llama3");
        assertThat(reloaded.getAcceptanceCriteria()).containsExactly("Dado X", "Entonces Y");
    }
}
