package com.flowpilot.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name="project_activity")
public class ProjectActivity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="project_id",nullable=false) private Long projectId;
 @Column(name="actor_id",nullable=false) private Long actorId;
 @Enumerated(EnumType.STRING) @Column(name="event_type",nullable=false,length=40) private ActivityEventType eventType;
 @Column(name="display_text",nullable=false,length=500) private String displayText;
 @Column(name="payload",nullable=false,length=4000) private String payload;
 @Column(name="created_at",nullable=false) private OffsetDateTime createdAt;
 protected ProjectActivity() {}
 public ProjectActivity(Long projectId, Long actorId, ActivityEventType eventType, String displayText, String payload){this.projectId=projectId;this.actorId=actorId;this.eventType=eventType;this.displayText=displayText;this.payload=payload==null?"{}":payload;this.createdAt=OffsetDateTime.now();}
 public Long getId(){return id;} public Long getProjectId(){return projectId;} public Long getActorId(){return actorId;} public ActivityEventType getEventType(){return eventType;} public String getDisplayText(){return displayText;} public String getPayload(){return payload;} public OffsetDateTime getCreatedAt(){return createdAt;}
}
