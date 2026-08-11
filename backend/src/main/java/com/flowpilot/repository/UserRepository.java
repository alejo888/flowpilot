package com.flowpilot.repository;

import com.flowpilot.entity.User;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * Row-locks (PESSIMISTIC_WRITE) every active {@code GlobalRole.ADMINISTRADOR}
     * for the duration of the caller's transaction, so two concurrent
     * deactivation/demotion requests cannot both observe "another admin
     * remains" and leave zero active Administradores (spec:
     * user-administration, last-Administrador lockout guard).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.role = com.flowpilot.entity.GlobalRole.ADMINISTRADOR AND u.active = true")
    List<User> findActiveAdministradoresForUpdate();
}
