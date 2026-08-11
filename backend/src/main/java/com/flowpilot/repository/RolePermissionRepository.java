package com.flowpilot.repository;

import com.flowpilot.entity.RolePermission;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {

    @Query("SELECT MAX(rp.updatedAt) FROM RolePermission rp")
    Optional<OffsetDateTime> findMaxUpdatedAt();
}
