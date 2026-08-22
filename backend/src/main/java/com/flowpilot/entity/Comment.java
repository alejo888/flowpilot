package com.flowpilot.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "comments")
public class Comment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="project_id", nullable=false) private Long projectId;
    @Column(name="work_item_id") private Long workItemId;
    @Column(name="author_id", nullable=false) private Long authorId;
    @Column(nullable=false, length=4000) private String content;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at", nullable=false) private OffsetDateTime updatedAt;
    protected Comment() {}
    public Comment(Long projectId, Long workItemId, Long authorId, String content) {
        this.projectId=projectId; this.workItemId=workItemId; this.authorId=authorId; this.content=content;
        this.createdAt=OffsetDateTime.now(); this.updatedAt=createdAt;
    }
    public Long getId(){return id;} public Long getProjectId(){return projectId;} public Long getWorkItemId(){return workItemId;}
    public Long getAuthorId(){return authorId;} public String getContent(){return content;} public OffsetDateTime getCreatedAt(){return createdAt;} public OffsetDateTime getUpdatedAt(){return updatedAt;}
    public void updateContent(String content){this.content=content; this.updatedAt=OffsetDateTime.now();}
}
