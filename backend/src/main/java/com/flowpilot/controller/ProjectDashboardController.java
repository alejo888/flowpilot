package com.flowpilot.controller;

import com.flowpilot.dto.ProjectDashboardResponse;
import com.flowpilot.service.ProjectDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import java.util.Objects;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProjectDashboardController {
    private final ProjectDashboardService service;
    public ProjectDashboardController(ProjectDashboardService service) { this.service = service; }
    @Operation(summary = "Get project dashboard aggregates")
    @GetMapping("/api/projects/{projectId}/dashboard")
    public ProjectDashboardResponse get(@PathVariable Long projectId, Authentication authentication) {
        return service.get(projectId, Long.valueOf(Objects.requireNonNull(authentication).getName()));
    }
}
