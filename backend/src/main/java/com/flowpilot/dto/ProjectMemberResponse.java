package com.flowpilot.dto;

import com.flowpilot.entity.ProjectRole;
import java.time.OffsetDateTime;

public record ProjectMemberResponse(
        Long id,
        Long projectId,
        Long userId,
        ProjectRole role,
        OffsetDateTime joinedAt) {
}
