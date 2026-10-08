package com.flowpilot.repository;

import com.flowpilot.entity.ProjectMember;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    List<ProjectMember> findByProjectId(Long projectId);

    Optional<ProjectMember> findByProjectIdAndUserId(Long projectId, Long userId);

    boolean existsByProjectIdAndUserId(Long projectId, Long userId);

    /** One user's memberships across many projects in a single query (batch permission resolution). */
    List<ProjectMember> findByUserIdAndProjectIdIn(Long userId, Collection<Long> projectIds);
}
