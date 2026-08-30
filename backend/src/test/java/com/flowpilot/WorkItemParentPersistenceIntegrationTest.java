package com.flowpilot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.flowpilot.entity.WorkItem;
import com.flowpilot.repository.WorkItemRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Pins the {@code parent_work_item_id} self-FK added by V21 against a real
 * Postgres container under {@code spring.jpa.hibernate.ddl-auto=validate}
 * (spec: work-item-hierarchy — "Migration/persistence"). A mismatch between
 * the {@link WorkItem#getParentWorkItemId()} mapping and the {@code bigint}
 * column fails the Spring context and errors every test here.
 *
 * <p>The FK is declared with NO ACTION (design D1): the DB rejects a bogus
 * parent id loudly instead of letting the app-level 409 be the only guard.
 * Requires Docker (Testcontainers-backed), same as {@link
 * FlowpilotApplicationTests}.
 */
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class WorkItemParentPersistenceIntegrationTest {

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
    void v21AddsNullableParentColumnAndSchemaValidates() {
        Integer columns = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.columns "
                        + "WHERE table_name = 'work_items' AND column_name = 'parent_work_item_id'",
                Integer.class);
        assertThat(columns).isEqualTo(1);
    }

    @Test
    void persistsAndReloadsTheParentLink() {
        long[] ids = anyProjectAndColumn();
        WorkItem parent = workItemRepository.save(
                new WorkItem(ids[0], ids[1], "Historia padre", null, null, 7168));
        WorkItem child = new WorkItem(ids[0], ids[1], "Subtarea", null, null, 8192);
        child.setParentWorkItemId(parent.getId());

        Long childId = workItemRepository.save(child).getId();
        WorkItem reloaded = workItemRepository.findById(childId).orElseThrow();

        assertThat(reloaded.getParentWorkItemId()).isEqualTo(parent.getId());
        assertThat(workItemRepository.countByParentWorkItemId(parent.getId())).isEqualTo(1);
        assertThat(workItemRepository.existsByParentWorkItemId(parent.getId())).isTrue();
        assertThat(workItemRepository.existsByParentWorkItemId(childId)).isFalse();
    }

    @Test
    void foreignKeyRejectsANonexistentParentId() {
        long[] ids = anyProjectAndColumn();
        WorkItem orphan = new WorkItem(ids[0], ids[1], "Subtarea sin padre real", null, null, 9216);
        orphan.setParentWorkItemId(999_999_999L);

        assertThatThrownBy(() -> workItemRepository.saveAndFlush(orphan))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
