package com.flowpilot.repository;

import com.flowpilot.entity.Sprint;
import com.flowpilot.entity.SprintStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SprintRepository extends JpaRepository<Sprint, Long> {

    List<Sprint> findByProjectIdOrderByStartDateAsc(Long projectId);

    boolean existsByProjectIdAndStatus(Long projectId, SprintStatus status);

    Optional<Sprint> findByIdAndProjectId(Long id, Long projectId);
}
