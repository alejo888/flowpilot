package com.flowpilot.repository;
import com.flowpilot.entity.Comment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CommentRepository extends JpaRepository<Comment,Long> {
 List<Comment> findByProjectIdAndWorkItemIdIsNullOrderByCreatedAtDescIdDesc(Long projectId);
 List<Comment> findByWorkItemIdOrderByCreatedAtDescIdDesc(Long workItemId);
}
