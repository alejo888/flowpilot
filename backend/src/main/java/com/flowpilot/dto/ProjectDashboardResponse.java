package com.flowpilot.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record ProjectDashboardResponse(long totalItems, long completedItems, List<ColumnCount> columnCounts,
        SprintSummary activeSprint, long activeSprintTotalItems, long activeSprintCompletedItems,
        long backlogPendingCount, List<AssigneeWorkload> workload, Map<String, Long> priorityDistribution) {
    public record ColumnCount(long columnId, String name, long count) { }
    public record SprintSummary(long id, String name, String goal, LocalDate startDate, LocalDate endDate) { }
    public record AssigneeWorkload(Long assigneeId, String assigneeName, long count) { }
}
