package com.flowpilot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.BacklogEpicRequest;
import com.flowpilot.dto.BacklogStoryRequest;
import com.flowpilot.dto.LoginRequest;
import com.flowpilot.dto.ProjectResponse;
import com.flowpilot.dto.ProjectWithBacklogRequest;
import com.flowpilot.dto.RegisterRequest;
import com.flowpilot.service.ProjectService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * {@code POST /api/projects/with-backlog} against a real Postgres: proves the
 * single-transaction contract (a failing item rolls back the project, its
 * columns, every work item and every activity event), the persisted shape of
 * the happy path, and the HTTP routing/security of the literal path segment.
 * Requires Docker.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectWithBacklogIntegrationTest {

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

    private static final String EMAIL = "backlog.owner@flowpilot.local";
    private static final String PASSWORD = "supersecret1";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private String token;

    /** Registers (idempotently) and logs in the owner; returns the owner id. */
    private long ownerId() throws Exception {
        if (token == null) {
            mockMvc.perform(post("/api/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsBytes(new RegisterRequest("Backlog Owner", EMAIL, PASSWORD))));
            String body = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsBytes(new LoginRequest(EMAIL, PASSWORD))))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            token = objectMapper.readTree(body).get("accessToken").asText();
        }
        return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, EMAIL);
    }

    private long count(String tableAndFilter) {
        return jdbc.queryForObject("SELECT count(*) FROM " + tableAndFilter, Long.class);
    }

    private ProjectWithBacklogRequest request(String name, String code, List<BacklogEpicRequest> epics) {
        return new ProjectWithBacklogRequest(name, "desc", code, null, null, null, null, epics, true, "llama3");
    }

    @Test
    void aFailingItemRollsBackTheProjectItsColumnsItsItemsAndItsActivity() throws Exception {
        long owner = ownerId();
        long projects = count("projects");
        long columns = count("board_columns");
        long items = count("work_items");
        long activity = count("project_activity");

        // Bypasses DTO validation (service called directly); violates varchar(255) at insert time.
        String tooLong = "x".repeat(300);
        ProjectWithBacklogRequest request = request("Atomic", "ATOMIC1", List.of(
                new BacklogEpicRequest("Epic 1", null, List.of(new BacklogStoryRequest("Story 1", null))),
                new BacklogEpicRequest("Epic 2", null, List.of(new BacklogStoryRequest(tooLong, null)))));

        assertThatThrownBy(() -> projectService.createWithBacklog(request, owner))
                .isInstanceOf(RuntimeException.class);

        assertThat(count("projects")).isEqualTo(projects);
        assertThat(count("board_columns")).isEqualTo(columns);
        assertThat(count("work_items")).isEqualTo(items);
        assertThat(count("project_activity")).isEqualTo(activity);
        assertThat(count("projects WHERE code = 'ATOMIC1'")).isZero();
    }

    @Test
    void happyPathPersistsProjectColumnsEpicsAndStoriesWithProvenanceAndActivity() throws Exception {
        long owner = ownerId();
        ProjectResponse response = projectService.createWithBacklog(request("Happy", "HAPPY1", List.of(
                new BacklogEpicRequest("Epic A", "desc", List.of(
                        new BacklogStoryRequest("A1", null), new BacklogStoryRequest("A2", null))),
                new BacklogEpicRequest("Epic B", null, List.of(new BacklogStoryRequest("B1", null))))), owner);

        long projectId = response.id();
        assertThat(response.ownerId()).isEqualTo(owner);
        assertThat(count("board_columns WHERE project_id = " + projectId)).isEqualTo(4);
        long firstColumn = jdbc.queryForObject(
                "SELECT id FROM board_columns WHERE project_id = ? ORDER BY position LIMIT 1", Long.class, projectId);

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, title, parent_work_item_id, column_id, position, ai_generated, ai_model, "
                        + "sprint_id, assigned_user_id FROM work_items WHERE project_id = ? ORDER BY position",
                projectId);
        assertThat(rows).extracting(r -> r.get("title")).containsExactly("Epic A", "A1", "A2", "Epic B", "B1");
        long epicA = ((Number) rows.get(0).get("id")).longValue();
        long epicB = ((Number) rows.get(3).get("id")).longValue();
        assertThat(rows.get(0).get("parent_work_item_id")).isNull();
        assertThat(rows.get(3).get("parent_work_item_id")).isNull();
        assertThat(((Number) rows.get(1).get("parent_work_item_id")).longValue()).isEqualTo(epicA);
        assertThat(((Number) rows.get(2).get("parent_work_item_id")).longValue()).isEqualTo(epicA);
        assertThat(((Number) rows.get(4).get("parent_work_item_id")).longValue()).isEqualTo(epicB);
        assertThat(rows).allSatisfy(r -> {
            assertThat(((Number) r.get("column_id")).longValue()).isEqualTo(firstColumn);
            assertThat(r.get("ai_generated")).isEqualTo(true);
            assertThat(r.get("ai_model")).isEqualTo("llama3");
            assertThat(r.get("sprint_id")).isNull();
            assertThat(r.get("assigned_user_id")).isNull();
        });
        assertThat(rows).extracting(r -> ((Number) r.get("position")).intValue())
                .containsExactly(1024, 2048, 3072, 4096, 5120);
        assertThat(count("project_activity WHERE project_id = " + projectId + " AND event_type = 'WORK_ITEM_CREATED'"))
                .isEqualTo(5);
        assertThat(count("project_activity WHERE project_id = " + projectId + " AND event_type = 'PROJECT_CREATED'"))
                .isEqualTo(1);
    }

    @Test
    void emptyEpicsCreatesJustTheProject() throws Exception {
        long owner = ownerId();
        ProjectResponse response = projectService.createWithBacklog(request("Empty", null, List.of()), owner);

        assertThat(count("board_columns WHERE project_id = " + response.id())).isEqualTo(4);
        assertThat(count("work_items WHERE project_id = " + response.id())).isZero();
    }

    @Test
    void httpEndpointIsRoutedRequiresAuthAndMapsDuplicateCodeTo409() throws Exception {
        ownerId();
        String json = objectMapper.writeValueAsString(request("Http", "HTTP1", List.of(
                new BacklogEpicRequest("Epic", null, List.of(new BacklogStoryRequest("Story", null))))));

        mockMvc.perform(post("/api/projects/with-backlog")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isUnauthorized());

        String created = mockMvc.perform(post("/api/projects/with-backlog")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("HTTP1"))
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(created);
        assertThat(count("work_items WHERE project_id = " + node.get("id").asLong())).isEqualTo(2);

        mockMvc.perform(post("/api/projects/with-backlog")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isConflict());
    }
}
