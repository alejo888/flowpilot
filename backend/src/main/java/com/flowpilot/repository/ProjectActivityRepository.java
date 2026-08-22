package com.flowpilot.repository;
import com.flowpilot.entity.ProjectActivity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ProjectActivityRepository extends JpaRepository<ProjectActivity,Long> {
 List<ProjectActivity> findByProjectIdOrderByCreatedAtDescIdDesc(Long projectId, org.springframework.data.domain.Pageable pageable);
}
