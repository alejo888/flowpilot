package com.flowpilot.service;

import com.flowpilot.dto.*;
import com.flowpilot.entity.*;
import com.flowpilot.exception.CommentNotFoundException;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.WorkItemNotFoundException;
import com.flowpilot.repository.*;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentService {
 private final CommentRepository comments; private final ProjectRepository projects; private final WorkItemRepository workItems; private final UserRepository users; private final ProjectAuthorizationService auth; private final ProjectActivityService activity;
 public CommentService(CommentRepository comments, ProjectRepository projects, WorkItemRepository workItems, UserRepository users, ProjectAuthorizationService auth, ProjectActivityService activity){this.comments=comments;this.projects=projects;this.workItems=workItems;this.users=users;this.auth=auth;this.activity=activity;}
 @Transactional public CommentResponse createForProject(Long projectId, CommentCreateRequest request, Long authorId){requireProject(projectId); requireCreate(authorId,projectId); return save(projectId,null,request.content(),authorId);}
 @Transactional public CommentResponse createForWorkItem(Long workItemId, CommentCreateRequest request, Long authorId){WorkItem item=workItems.findById(workItemId).orElseThrow(()->new WorkItemNotFoundException(workItemId)); requireCreate(authorId,item.getProjectId()); return save(item.getProjectId(),workItemId,request.content(),authorId);}
 public List<CommentResponse> listProject(Long projectId,Long userId,int limit,int offset){requireView(userId,projectId); return page(comments.findByProjectIdAndWorkItemIdIsNullOrderByCreatedAtDescIdDesc(projectId),limit,offset);}
 public List<CommentResponse> listWorkItem(Long workItemId,Long userId,int limit,int offset){WorkItem item=workItems.findById(workItemId).orElseThrow(()->new WorkItemNotFoundException(workItemId)); requireView(userId,item.getProjectId()); return page(comments.findByWorkItemIdOrderByCreatedAtDescIdDesc(workItemId),limit,offset);}
 @Transactional public CommentResponse update(Long id,CommentUpdateRequest request,Long userId){Comment c=requireComment(id); requireView(userId,c.getProjectId()); requireAuthor(c,userId); c.updateContent(request.content()); activity.record(c.getProjectId(),userId,ActivityEventType.COMMENT_UPDATED,"Comment updated","{\"commentId\":"+id+"}"); return response(c);}
 @Transactional public void delete(Long id,Long userId){Comment c=requireComment(id); requireView(userId,c.getProjectId()); requireAuthor(c,userId); comments.delete(c); activity.record(c.getProjectId(),userId,ActivityEventType.COMMENT_DELETED,"Comment deleted","{\"commentId\":"+id+"}");}
 private CommentResponse save(Long projectId,Long workItemId,String content,Long authorId){Comment c=comments.save(new Comment(projectId,workItemId,authorId,content)); activity.record(projectId,authorId,ActivityEventType.COMMENT_CREATED,"Comment created","{\"commentId\":"+c.getId()+"}"); return response(c);}
 private Comment requireComment(Long id){return comments.findById(id).orElseThrow(()->new CommentNotFoundException(id));}
 private void requireAuthor(Comment c,Long userId){if(!c.getAuthorId().equals(userId)) throw new AccessDeniedException("Solo el autor del comentario puede modificarlo o eliminarlo");}
 private void requireCreate(Long userId,Long projectId){if(!auth.hasPermission(userId,projectId,Permission.COMMENT_CREATE)) throw new AccessDeniedException("Missing COMMENT_CREATE permission");}
 private void requireView(Long userId,Long projectId){if(!auth.canView(userId,projectId)) throw new AccessDeniedException("Not authorized to view project");}
 private void requireProject(Long id){if(projects.findById(id).isEmpty()) throw new ProjectNotFoundException(id);}
 private List<CommentResponse> page(List<Comment> all,int limit,int offset){if(limit<1||limit>100||offset<0) throw new IllegalArgumentException("limit must be 1..100 and offset must be non-negative"); return all.stream().skip(offset).limit(limit).map(this::response).toList();}
 private CommentResponse response(Comment c){String name=users.findById(c.getAuthorId()).map(User::getName).orElse(null);return new CommentResponse(c.getId(),c.getProjectId(),c.getWorkItemId(),c.getAuthorId(),name,c.getContent(),c.getCreatedAt(),c.getUpdatedAt());}
}
