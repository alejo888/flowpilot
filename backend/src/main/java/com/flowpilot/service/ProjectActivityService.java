package com.flowpilot.service;

import com.flowpilot.dto.ActivityResponse;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.ProjectActivity;
import com.flowpilot.repository.ProjectActivityRepository;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class ProjectActivityService {
 private final ProjectActivityRepository repository;
 public ProjectActivityService(ProjectActivityRepository repository){this.repository=repository;}
 public void record(Long projectId, Long actorId, ActivityEventType type, String displayText, String payload){repository.save(new ProjectActivity(projectId,actorId,type,displayText,payload));}
 public List<ActivityResponse> list(Long projectId, int limit, int offset){
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
