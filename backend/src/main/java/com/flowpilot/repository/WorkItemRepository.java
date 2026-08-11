package com.flowpilot.repository;

import com.flowpilot.entity.WorkItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkItemRepository extends JpaRepository<WorkItem, Long> {

    List<WorkItem> findByProjectIdOrderByColumnIdAscPositionAsc(Long projectId);

    Optional<WorkItem> findFirstByColumnIdOrderByPositionDesc(Long columnId);

    List<WorkItem> findByColumnIdOrderByPositionAsc(Long columnId);
}
