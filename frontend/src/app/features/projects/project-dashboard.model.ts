export interface ProjectDashboard {
  totalItems: number; completedItems: number;
  columnCounts: { columnId: number; name: string; count: number }[];
  activeSprint: { id: number; name: string; goal: string | null; startDate: string; endDate: string } | null;
  activeSprintTotalItems: number; activeSprintCompletedItems: number; backlogPendingCount: number;
  workload: { assigneeId: number; assigneeName: string; count: number }[];
  priorityDistribution: Record<string, number>;
}
