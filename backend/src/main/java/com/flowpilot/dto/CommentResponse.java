package com.flowpilot.dto;
import java.time.OffsetDateTime;
public record CommentResponse(Long id, Long projectId, Long workItemId, Long authorId, String authorName, String content, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
