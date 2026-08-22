package com.flowpilot.dto;
import com.flowpilot.entity.ActivityEventType;
import java.time.OffsetDateTime;
public record ActivityResponse(Long id, Long projectId, Long actorId, ActivityEventType eventType, String displayText, String payload, OffsetDateTime createdAt) {}
