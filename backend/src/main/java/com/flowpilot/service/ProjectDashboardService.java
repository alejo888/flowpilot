package com.flowpilot.service;

import com.flowpilot.dto.ProjectDashboardResponse;
import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.SprintStatus;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.entity.WorkItemPriority;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.SprintRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class ProjectDashboardService {
    private final WorkItemRepository items; private final BoardColumnRepository columns; private final SprintRepository sprints; private final UserRepository users; private final ProjectAuthorizationService auth;
    public ProjectDashboardService(WorkItemRepository items, BoardColumnRepository columns, SprintRepository sprints, UserRepository users, ProjectAuthorizationService auth) { this.items=items;this.columns=columns;this.sprints=sprints;this.users=users;this.auth=auth; }
    public ProjectDashboardResponse get(Long projectId, Long userId) {
        if (!auth.canView(userId, projectId)) throw new AccessDeniedException("No autorizado para ver el dashboard del proyecto");
        List<WorkItem> all=items.findByProjectIdOrderByColumnIdAscPositionAsc(projectId);
        var cols=columns.findByProjectIdOrderByPositionAsc(projectId);
        Map<Long,Long> counts=new LinkedHashMap<>(); cols.forEach(c->counts.put(c.getId(),all.stream().filter(i->i.getColumnId().equals(c.getId())).count()));
        List<ProjectDashboardResponse.ColumnCount> columnCounts=cols.stream().map(c->new ProjectDashboardResponse.ColumnCount(c.getId(),c.getName(),counts.get(c.getId()))).toList();
        long completed=all.stream().filter(i->cols.stream().anyMatch(c->c.getId().equals(i.getColumnId()) && c.getName().equalsIgnoreCase("Terminado"))).count();
        Sprint active=sprints.findByProjectIdOrderByStartDateAsc(projectId).stream().filter(s->s.getStatus()==SprintStatus.ACTIVE).findFirst().orElse(null);
        List<WorkItem> sprintItems=active==null?List.of():all.stream().filter(i->active.getId().equals(i.getSprintId())).toList();
        Map<Long,String> names=new LinkedHashMap<>(); users.findAllById(all.stream().map(WorkItem::getAssignedUserId).filter(java.util.Objects::nonNull).distinct().toList()).forEach(u->names.put(u.getId(),u.getName()));
        List<ProjectDashboardResponse.AssigneeWorkload> workload=all.stream().filter(i->i.getAssignedUserId()!=null).collect(java.util.stream.Collectors.groupingBy(WorkItem::getAssignedUserId,LinkedHashMap::new,java.util.stream.Collectors.counting())).entrySet().stream().map(e->new ProjectDashboardResponse.AssigneeWorkload(e.getKey(),names.get(e.getKey()),e.getValue())).toList();
        Map<String,Long> priority=new LinkedHashMap<>(); Arrays.stream(WorkItemPriority.values()).forEach(p->priority.put(p.name(),all.stream().filter(i->i.getPriority()==p).count()));
        var summary=active==null?null:new ProjectDashboardResponse.SprintSummary(active.getId(),active.getName(),active.getGoal(),active.getStartDate(),active.getEndDate());
        return new ProjectDashboardResponse(all.size(),completed,columnCounts,summary,sprintItems.size(),sprintItems.stream().filter(i->i.getColumnId()!=null && cols.stream().anyMatch(c->c.getId().equals(i.getColumnId())&&c.getName().equalsIgnoreCase("Terminado"))).count(),all.stream().filter(i->i.getSprintId()==null).count(),workload,priority);
    }
}
