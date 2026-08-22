package com.flowpilot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Exports the live, springdoc-generated OpenAPI document
 * ({@code /v3/api-docs}) to {@code target/openapi-generated.json} so a later
 * CI step (oasdiff, in {@code .github/workflows/ci.yml}) can diff it against
 * the hand-authored source of truth, {@code api/openapi.yaml}. This test's
 * only job is exporting the file and failing loudly if the app can't serve
 * it — the actual spec comparison happens outside the JVM (oasdiff is a Go
 * CLI). Requires Docker — runs in CI (Testcontainers-backed), same as
 * {@link AuthFlowIntegrationTest} and {@link FlowpilotApplicationTests}.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiSpecExportTest {

    private static final Path OUTPUT_PATH = Path.of("target", "openapi-generated.json");

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
    private MockMvc mockMvc;

    @Test
    void healthEndpointIsPublicAndReportsUp() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void otherActuatorEndpointsRemainProtected() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void exportsLiveOpenApiDocumentForDriftCheck() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).isNotBlank();

        Files.createDirectories(OUTPUT_PATH.getParent());
        Files.writeString(OUTPUT_PATH, body);
    }
}
