package com.flowpilot.service;

import com.flowpilot.dto.ProjectDashboardResponse;
import com.flowpilot.entity.BoardColumn;
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
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectDashboardService {
    /**
     * Canonical "done" column name, reused from {@link ProjectService#DEFAULT_COLUMN_NAMES}
     * so completion metrics can't drift from the project bootstrap's own column names.
     * Boards have no explicit "is this the done column" flag (schema limitation, {@code
     * board_columns} table) — a project whose final column isn't named exactly this reports
     * 0 completed items. See {@code ProjectDashboardServiceTest#completionCountsRequireExactDoneColumnName}.
     */
    private static final String VIEW_DENIED_MESSAGE = "No autorizado para ver el dashboard del proyecto";
    private static final String DONE_COLUMN_NAME = ProjectService.DEFAULT_COLUMN_NAMES.getLast();

    private final WorkItemRepository items; private final BoardColumnRepository columns; private final SprintRepository sprints; private final UserRepository users; private final ProjectAccessGuard accessGuard;
    public ProjectDashboardService(WorkItemRepository items, BoardColumnRepository columns, SprintRepository sprints, UserRepository users, ProjectAccessGuard accessGuard) { this.items=items;this.columns=columns;this.sprints=sprints;this.users=users;this.accessGuard=accessGuard; }

    @Transactional(readOnly = true)
    public ProjectDashboardResponse get(Long projectId, Long userId) {
        accessGuard.requireCanView(userId, projectId, VIEW_DENIED_MESSAGE);
        accessGuard.requireProjectExists(projectId);
        List<WorkItem> all=items.findByProjectIdOrderByColumnIdAscPositionAsc(projectId);
        var cols=columns.findByProjectIdOrderByPositionAsc(projectId);
        java.util.Set<Long> doneColumnIds=cols.stream().filter(c->c.getName().equalsIgnoreCase(DONE_COLUMN_NAME)).map(BoardColumn::getId).collect(Collectors.toSet());

        Map<Long,Long> itemCountByColumnId=all.stream()
                .collect(Collectors.groupingBy(WorkItem::getColumnId, LinkedHashMap::new, Collectors.counting()));
        List<ProjectDashboardResponse.ColumnCount> columnCounts=cols.stream()
                .map(c->new ProjectDashboardResponse.ColumnCount(c.getId(),c.getName(),itemCountByColumnId.getOrDefault(c.getId(),0L)))
                .toList();
        long completed=all.stream().filter(i->doneColumnIds.contains(i.getColumnId())).count();

        Sprint active=sprints.findByProjectIdOrderByStartDateAsc(projectId).stream().filter(s->s.getStatus()==SprintStatus.ACTIVE).findFirst().orElse(null);
        List<WorkItem> sprintItems=active==null?List.of():all.stream().filter(i->active.getId().equals(i.getSprintId())).toList();
        long sprintCompleted=sprintItems.stream().filter(i->i.getColumnId()!=null && doneColumnIds.contains(i.getColumnId())).count();

        Map<Long,String> names=new LinkedHashMap<>(); users.findAllById(all.stream().map(WorkItem::getAssignedUserId).filter(Objects::nonNull).distinct().toList()).forEach(u->names.put(u.getId(),u.getName()));
        List<ProjectDashboardResponse.AssigneeWorkload> workload=all.stream().filter(i->i.getAssignedUserId()!=null).collect(Collectors.groupingBy(WorkItem::getAssignedUserId,LinkedHashMap::new,Collectors.counting())).entrySet().stream().map(e->new ProjectDashboardResponse.AssigneeWorkload(e.getKey(),names.get(e.getKey()),e.getValue())).toList();

        Map<WorkItemPriority,Long> priorityCounts=all.stream()
                .collect(Collectors.groupingBy(WorkItem::getPriority, Collectors.counting()));
        Map<String,Long> priority=new LinkedHashMap<>();
        Arrays.stream(WorkItemPriority.values()).forEach(p->priority.put(p.name(),priorityCounts.getOrDefault(p,0L)));

        var summary=active==null?null:new ProjectDashboardResponse.SprintSummary(active.getId(),active.getName(),active.getGoal(),active.getStartDate(),active.getEndDate());
        long backlogPending=all.stream().filter(i->i.getSprintId()==null).count();
        return new ProjectDashboardResponse(all.size(),completed,columnCounts,summary,sprintItems.size(),sprintCompleted,backlogPending,workload,priority);
    }
}
