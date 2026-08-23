package com.flowpilot.repository;

import com.flowpilot.entity.Project;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByOwnerId(Long ownerId);

    /**
     * Every project a non-admin caller may see: the ones they own, plus the
     * ones they were added to as a {@code ProjectMember} (a project owner is
     * never also inserted as their own member row, but the {@code OR} covers
     * that combination too in case it ever happens). {@code
     * ProjectAuthorizationService#canView} already grants read access to
     * both groups; {@code list()} previously only returned the owned half.
     */
    @Query("SELECT DISTINCT p FROM Project p WHERE p.ownerId = :userId "
            + "OR p.id IN (SELECT pm.projectId FROM ProjectMember pm WHERE pm.userId = :userId)")
    List<Project> findVisibleToUser(@Param("userId") Long userId);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);
}
