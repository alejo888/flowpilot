package com.flowpilot.controller;

import com.flowpilot.dto.WorkItemCreateRequest;
import com.flowpilot.dto.WorkItemResponse;
import com.flowpilot.dto.WorkItemUpdateRequest;
import com.flowpilot.service.WorkItemService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * WorkItem CRUD endpoints (spec: work-items). Create/list are nested under a
 * project ({@code /api/projects/{projectId}/work-items}); read/update/delete
 * address a single item directly ({@code /api/work-items/{id}}) since a
 * {@code WorkItem} already carries its own {@code projectId}. Writes require
 * the caller to be the project's owner or a global administrator — same
 * interim rule as {@link ProjectController}/{@link ProjectMemberController}.
 * The move endpoint ({@code PUT /api/work-items/{id}/move}) is slice 6 and
 * intentionally not implemented here.
 */
@RestController
public class WorkItemController {

    private final WorkItemService workItemService;

    public WorkItemController(WorkItemService workItemService) {
        this.workItemService = workItemService;
    }

    @PostMapping("/api/projects/{projectId}/work-items")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkItemResponse create(
            @PathVariable Long projectId,
            @Valid @RequestBody WorkItemCreateRequest request,
            Authentication authentication) {
        return workItemService.create(projectId, request, currentUserId(authentication));
    }

    @GetMapping("/api/projects/{projectId}/work-items")
    public List<WorkItemResponse> list(@PathVariable Long projectId, Authentication authentication) {
        return workItemService.list(projectId, currentUserId(authentication));
    }

    @GetMapping("/api/work-items/{id}")
    public WorkItemResponse getById(@PathVariable Long id, Authentication authentication) {
        return workItemService.findById(id, currentUserId(authentication));
    }

    @PutMapping("/api/work-items/{id}")
    public WorkItemResponse update(
            @PathVariable Long id, @Valid @RequestBody WorkItemUpdateRequest request, Authentication authentication) {
        return workItemService.update(id, request, currentUserId(authentication));
    }

    @DeleteMapping("/api/work-items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, Authentication authentication) {
        workItemService.delete(id, currentUserId(authentication));
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
