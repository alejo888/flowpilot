package com.flowpilot.controller;

import com.flowpilot.dto.*;
import com.flowpilot.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
public class CommentController {
 private final CommentService comments; private final ProjectActivityService activity; private final ProjectAuthorizationService auth;
 public CommentController(CommentService comments,ProjectActivityService activity,ProjectAuthorizationService auth){this.comments=comments;this.activity=activity;this.auth=auth;}
 @GetMapping("/api/projects/{projectId}/comments") public List<CommentResponse> projectComments(@PathVariable Long projectId,@RequestParam(defaultValue="20") @Min(value=1,message="El límite debe ser al menos 1") @Max(value=100,message="El límite no puede superar 100") int limit,@RequestParam(defaultValue="0") @Min(value=0,message="El desplazamiento no puede ser negativo") int offset,Authentication a){return comments.listProject(projectId,id(a),limit,offset);}
 @PostMapping("/api/projects/{projectId}/comments") @ResponseStatus(HttpStatus.CREATED) public CommentResponse createProject(@PathVariable Long projectId,@Valid @RequestBody CommentCreateRequest r,Authentication a){return comments.createForProject(projectId,r,id(a));}
 @GetMapping("/api/work-items/{workItemId}/comments") public List<CommentResponse> workItemComments(@PathVariable Long workItemId,@RequestParam(defaultValue="20") @Min(value=1,message="El límite debe ser al menos 1") @Max(value=100,message="El límite no puede superar 100") int limit,@RequestParam(defaultValue="0") @Min(value=0,message="El desplazamiento no puede ser negativo") int offset,Authentication a){return comments.listWorkItem(workItemId,id(a),limit,offset);}
 @PostMapping("/api/work-items/{workItemId}/comments") @ResponseStatus(HttpStatus.CREATED) public CommentResponse createWorkItem(@PathVariable Long workItemId,@Valid @RequestBody CommentCreateRequest r,Authentication a){return comments.createForWorkItem(workItemId,r,id(a));}
 @PutMapping("/api/comments/{commentId}") public CommentResponse update(@PathVariable Long commentId,@Valid @RequestBody CommentUpdateRequest r,Authentication a){return comments.update(commentId,r,id(a));}
 @DeleteMapping("/api/comments/{commentId}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable Long commentId,Authentication a){comments.delete(commentId,id(a));}
 @GetMapping("/api/projects/{projectId}/activity") public List<ActivityResponse> activity(@PathVariable Long projectId,@RequestParam(defaultValue="20") @Min(value=1,message="El límite debe ser al menos 1") @Max(value=100,message="El límite no puede superar 100") int limit,@RequestParam(defaultValue="0") @Min(value=0,message="El desplazamiento no puede ser negativo") int offset,Authentication a){if(!auth.canView(id(a),projectId)) throw new org.springframework.security.access.AccessDeniedException("No autorizado a ver el proyecto");return activity.list(projectId,limit,offset);}
 private Long id(Authentication a){return Long.parseLong(a.getName());}
}
