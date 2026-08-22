package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.CommentCreateRequest;
import com.flowpilot.dto.CommentUpdateRequest;
import com.flowpilot.entity.Comment;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.User;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.repository.CommentRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class CommentServiceTest {
    @Mock CommentRepository comments;
    @Mock ProjectRepository projects;
    @Mock WorkItemRepository workItems;
    @Mock UserRepository users;
    @Mock ProjectActivityService activity;
    private ProjectAuthorizationService auth;
    private CommentService service;

    @BeforeEach
    void setUp() {
        auth = mock(ProjectAuthorizationService.class);
        service = new CommentService(comments, projects, workItems, users, auth, activity);
    }

    @Test
    void projectAndWorkItemReadsRequireProjectViewAuthorization() throws Exception {
        when(auth.canView(2L, 10L)).thenReturn(false);
        assertThatThrownBy(() -> service.listProject(10L, 2L, 20, 0)).isInstanceOf(AccessDeniedException.class);

        WorkItem item = item(50L, 10L);
        when(workItems.findById(50L)).thenReturn(Optional.of(item));
        assertThatThrownBy(() -> service.listWorkItem(50L, 2L, 20, 0)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void commentCreateRequiresPermissionForProjectAndWorkItemProject() throws Exception {
        when(projects.findById(10L)).thenReturn(Optional.of(mock(com.flowpilot.entity.Project.class)));
        when(auth.hasPermission(2L, 10L, Permission.COMMENT_CREATE)).thenReturn(false);
        assertThatThrownBy(() -> service.createForProject(10L, new CommentCreateRequest("x"), 2L))
                .isInstanceOf(AccessDeniedException.class);

        WorkItem item = item(50L, 99L);
        when(workItems.findById(50L)).thenReturn(Optional.of(item));
        assertThatThrownBy(() -> service.createForWorkItem(50L, new CommentCreateRequest("x"), 2L))
                .isInstanceOf(AccessDeniedException.class);
        verify(auth).hasPermission(2L, 99L, Permission.COMMENT_CREATE);
    }

    @Test
    void listUsesNewestFirstResultsAndSupportsArbitraryOffset() throws Exception {
        when(auth.canView(1L, 10L)).thenReturn(true);
        Comment first = comment(1L, 10L, null, 1L, "newest");
        Comment second = comment(2L, 10L, null, 1L, "next");
        Comment third = comment(3L, 10L, null, 1L, "older");
        when(comments.findByProjectIdAndWorkItemIdIsNullOrderByCreatedAtDescIdDesc(10L))
                .thenReturn(List.of(first, second, third));
        when(users.findById(1L)).thenReturn(Optional.empty());

        assertThat(service.listProject(10L, 1L, 1, 1)).extracting(r -> r.content()).containsExactly("next");
    }

    @Test
    void onlyAuthorMayEditAndUpdateRecordsActivity() throws Exception {
        Comment comment = comment(7L, 10L, null, 4L, "old");
        when(comments.findById(7L)).thenReturn(Optional.of(comment));
        when(auth.canView(9L, 10L)).thenReturn(true);
        assertThatThrownBy(() -> service.update(7L, new CommentUpdateRequest("no"), 9L))
                .isInstanceOf(AccessDeniedException.class);

        when(auth.canView(4L, 10L)).thenReturn(true);
        var response = service.update(7L, new CommentUpdateRequest("new"), 4L);
        assertThat(response.content()).isEqualTo("new");
        verify(activity).record(10L, 4L, com.flowpilot.entity.ActivityEventType.COMMENT_UPDATED,
                "Comment updated", "{\"commentId\":7}");
    }

    @Test
    void authorWhoCanNoLongerViewProjectCannotEditComment() throws Exception {
        Comment comment = comment(7L, 10L, null, 4L, "old");
        when(comments.findById(7L)).thenReturn(Optional.of(comment));
        when(auth.canView(4L, 10L)).thenReturn(false);

        assertThatThrownBy(() -> service.update(7L, new CommentUpdateRequest("new"), 4L))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(comment.getContent()).isEqualTo("old");
        verify(activity, org.mockito.Mockito.never()).record(any(), any(), any(), any(), any());
    }

    private Comment comment(Long id, Long projectId, Long workItemId, Long authorId, String content) throws Exception {
        Comment value = new Comment(projectId, workItemId, authorId, content);
        Field field = Comment.class.getDeclaredField("id"); field.setAccessible(true); field.set(value, id);
        return value;
    }

    private WorkItem item(Long id, Long projectId) throws Exception {
        WorkItem value = new WorkItem(projectId, 1L, "task", null, null, 1);
        Field field = WorkItem.class.getDeclaredField("id"); field.setAccessible(true); field.set(value, id);
        return value;
    }
}
