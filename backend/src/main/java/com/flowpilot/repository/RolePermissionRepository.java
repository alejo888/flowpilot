package com.flowpilot.repository;

import com.flowpilot.entity.RolePermission;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {

    @Query("SELECT MAX(rp.updatedAt) FROM RolePermission rp")
    Optional<OffsetDateTime> findMaxUpdatedAt();

    /**
     * Row-locks (PESSIMISTIC_WRITE) every grant row, same convention as
     * {@code UserRepository#findActiveAdministradoresForUpdate()}. Serializes
     * concurrent {@code replaceAll} callers so the optimistic-concurrency
     * check-then-act can no longer let a second writer silently overwrite the
     * first: the second caller blocks until the first commits, then re-reads
     * a {@code MAX(updated_at)} that already reflects the first write.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rp FROM RolePermission rp")
    List<RolePermission> findAllForUpdate();
}
