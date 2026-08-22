package com.flowpilot.controller;

import com.flowpilot.dto.SprintCreateRequest;
import com.flowpilot.dto.SprintResponse;
import com.flowpilot.dto.SprintUpdateRequest;
import com.flowpilot.service.SprintService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SprintController {

    private final SprintService sprintService;

    public SprintController(SprintService sprintService) {
        this.sprintService = sprintService;
    }

    @PostMapping("/api/projects/{projectId}/sprints")
    @ResponseStatus(HttpStatus.CREATED)
    public SprintResponse create(
            @PathVariable Long projectId,
            @Valid @RequestBody SprintCreateRequest request,
            Authentication auth) {
        return sprintService.create(projectId, request, userId(auth));
    }

    @GetMapping("/api/projects/{projectId}/sprints")
    public List<SprintResponse> list(@PathVariable Long projectId, Authentication auth) {
        return sprintService.list(projectId, userId(auth));
    }

    @PutMapping("/api/sprints/{id}")
    public SprintResponse update(
            @PathVariable Long id,
            @Valid @RequestBody SprintUpdateRequest request,
            Authentication auth) {
        return sprintService.update(id, request, userId(auth));
    }

    @PostMapping("/api/sprints/{id}/start")
    public SprintResponse start(@PathVariable Long id, Authentication auth) {
        return sprintService.start(id, userId(auth));
    }

    @PostMapping("/api/sprints/{id}/complete")
    public SprintResponse complete(@PathVariable Long id, Authentication auth) {
        return sprintService.complete(id, userId(auth));
    }

    private Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
