package com.flowpilot.repository;

import com.flowpilot.entity.BoardColumn;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardColumnRepository extends JpaRepository<BoardColumn, Long> {

    List<BoardColumn> findByProjectIdOrderByPositionAsc(Long projectId);
}
