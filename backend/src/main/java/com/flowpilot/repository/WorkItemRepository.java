package com.flowpilot.repository;

import com.flowpilot.entity.WorkItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkItemRepository extends JpaRepository<WorkItem, Long> {

    List<WorkItem> findByProjectIdOrderByColumnIdAscPositionAsc(Long projectId);

    Optional<WorkItem> findFirstByColumnIdOrderByPositionDesc(Long columnId);

    List<WorkItem> findByColumnIdOrderByPositionAsc(Long columnId);

    /** Direct-subtask count for the delete-with-children 409 guard (spec: work-item-hierarchy). */
    long countByParentWorkItemId(Long parentWorkItemId);

    /** Whether the given work item is itself a parent — blocks it from becoming a subtask. */
    boolean existsByParentWorkItemId(Long parentWorkItemId);
}
