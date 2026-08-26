package com.flowpilot.service;

import com.flowpilot.dto.ActivityResponse;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.ProjectActivity;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.ProjectActivityRepository;
import com.flowpilot.repository.ProjectRepository;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class ProjectActivityService {
 private final ProjectActivityRepository repository;
 private final ProjectRepository projects;
 public ProjectActivityService(ProjectActivityRepository repository, ProjectRepository projects){this.repository=repository;this.projects=projects;}
 public void record(Long projectId, Long actorId, ActivityEventType type, String displayText, String payload){repository.save(new ProjectActivity(projectId,actorId,type,displayText,payload));}
 /**
  * Explicit project-existence check independent of the caller's view
  * permission: {@code ProjectAuthorizationService.canView} short-circuits
  * {@code true} for a global admin without ever looking up the project, so
  * without this check an admin listing activity for a nonexistent project
  * got a silent {@code 200 []} instead of the {@code 404} every other
  * caller (whose {@code canView} path does reach the project lookup) gets.
  */
 public List<ActivityResponse> list(Long projectId, int limit, int offset){
  if(projects.findById(projectId).isEmpty()) throw new ProjectNotFoundException(projectId);
  validate(limit,offset);
  int page = offset / limit;
  int remainder = offset % limit;
  List<ProjectActivity> activities = repository.findByProjectIdOrderByCreatedAtDescIdDesc(projectId, PageRequest.of(page, limit));
  if (remainder > 0 && activities.size() == limit) {
   activities = java.util.stream.Stream.concat(activities.stream(), repository.findByProjectIdOrderByCreatedAtDescIdDesc(projectId, PageRequest.of(page + 1, limit)).stream()).toList();
  }
  return activities.stream().skip(remainder).limit(limit).map(a->new ActivityResponse(a.getId(),a.getProjectId(),a.getActorId(),a.getEventType(),a.getDisplayText(),a.getPayload(),a.getCreatedAt())).toList();
}
 private static void validate(int limit,int offset){if(limit<1||limit>100||offset<0) throw new IllegalArgumentException("limit must be 1..100 and offset must be non-negative");}
}
