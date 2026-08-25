package com.flowpilot;

import static org.assertj.core.api.Assertions.assertThat;

import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.repository.RolePermissionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * V6/V7 migration integrity against a real Postgres container (design's
 * "empty/unusable first boot" risk mitigation, task 8a.2). Requires Docker —
 * runs in CI (Testcontainers-backed), same as {@link
 * com.flowpilot.AuthFlowIntegrationTest} and {@link
 * FlowpilotApplicationTests}.
 */
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class RolePermissionSeedIntegrationTest {

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
    private RolePermissionRepository rolePermissionRepository;

    @Test
    void seedMigrationInsertsExactlyFiftyFourDenseRows() {
        assertThat(rolePermissionRepository.findAll())
                .hasSize(ProjectRole.values().length * Permission.values().length);
    }

    @Test
    void seedDefaultsLetAPlainDeveloperCreateEditAndMoveWorkItemsOnAFreshDatabase() {
        // spec: role-permissions, proposal Success Criteria — "On a fresh
        // database with zero admin configuration, a Developer member can
        // create, edit, and move a WorkItem".
        var developerGrants = rolePermissionRepository.findAll().stream()
                .filter(row -> row.getRole() == ProjectRole.DEVELOPER)
                .toList();

        assertThat(developerGrants).hasSize(Permission.values().length);
        assertThat(developerGrants.stream().filter(row -> row.getPermission() == Permission.WORKITEM_CREATE))
                .allMatch(row -> row.isGranted());
        assertThat(developerGrants.stream().filter(row -> row.getPermission() == Permission.WORKITEM_EDIT))
                .allMatch(row -> row.isGranted());
        assertThat(developerGrants.stream().filter(row -> row.getPermission() == Permission.WORKITEM_MOVE))
                .allMatch(row -> row.isGranted());
    }

    @Test
    void sprintManageIsGrantedOnlyToTheTwoPlanningRoles() {
        // V17: sprint lifecycle control is no longer piggy-backed on
        // WORKITEM_EDIT (which every role holds).
        var sprintManageGrants = rolePermissionRepository.findAll().stream()
                .filter(row -> row.getPermission() == Permission.SPRINT_MANAGE)
                .toList();

        assertThat(sprintManageGrants).hasSize(ProjectRole.values().length);
        assertThat(sprintManageGrants.stream().filter(row -> row.isGranted()))
                .extracting(row -> row.getRole())
                .containsExactlyInAnyOrder(ProjectRole.PROJECT_MANAGER, ProjectRole.PRODUCT_OWNER);
    }

    @Test
    void projectDeleteIsGrantedToNoRoleByDefault() {
        // Owner (5c) and global admin (6) already cover deletion.
        var projectDeleteGrants = rolePermissionRepository.findAll().stream()
                .filter(row -> row.getPermission() == Permission.PROJECT_DELETE)
                .toList();

        assertThat(projectDeleteGrants).hasSize(ProjectRole.values().length);
        assertThat(projectDeleteGrants).noneMatch(row -> row.isGranted());
    }
}
