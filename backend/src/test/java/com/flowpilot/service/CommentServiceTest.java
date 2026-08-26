package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.springframework.data.domain.PageRequest;

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
        when(projects.findById(10L)).thenReturn(Optional.of(mock(com.flowpilot.entity.Project.class)));
        when(auth.canView(2L, 10L)).thenReturn(false);
        assertThatThrownBy(() -> service.listProject(10L, 2L, 20, 0)).isInstanceOf(AccessDeniedException.class);

        WorkItem item = item(50L, 10L);
        when(workItems.findById(50L)).thenReturn(Optional.of(item));
        assertThatThrownBy(() -> service.listWorkItem(50L, 2L, 20, 0)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void listProjectThrowsNotFoundForNonexistentProjectEvenWhenViewWouldBeAllowed() {
        // canView short-circuits true for a global admin WITHOUT looking up the
        // project, so without an explicit existence check here an admin caller
        // would silently get an empty list instead of a 404 for a nonexistent
        // project id — unlike every other caller, whose canView path does reach
        // the project lookup and throws. Stubbed lenient-equivalent: canView is
        // never reached because requireProject throws first.
        when(projects.findById(999L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.listProject(999L, 1L, 20, 0))
                .isInstanceOf(com.flowpilot.exception.ProjectNotFoundException.class);
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
        when(projects.findById(10L)).thenReturn(Optional.of(mock(com.flowpilot.entity.Project.class)));
        when(auth.canView(1L, 10L)).thenReturn(true);
        Comment second = comment(2L, 10L, null, 1L, "next");
        when(comments.findByProjectIdAndWorkItemIdIsNullOrderByCreatedAtDescIdDesc(10L, PageRequest.of(1, 1)))
                .thenReturn(List.of(second));
        when(users.findById(1L)).thenReturn(Optional.empty());

        assertThat(service.listProject(10L, 1L, 1, 1)).extracting(r -> r.content()).containsExactly("next");
    }

    @Test
    void listPaginatesAtTheQueryLevelForANonPageAlignedOffset() throws Exception {
        // limit=2, offset=1 is not page-aligned (page=0, remainder=1): the first
        // page-sized fetch is exactly full, so a second page must be fetched and
        // the two results concatenated before the in-page remainder is skipped —
        // proves pagination happens at the query level (via CommentRepository's
        // Pageable-taking finder), not by loading everything into memory.
        when(projects.findById(10L)).thenReturn(Optional.of(mock(com.flowpilot.entity.Project.class)));
        when(auth.canView(1L, 10L)).thenReturn(true);
        Comment first = comment(1L, 10L, null, 1L, "newest");
        Comment second = comment(2L, 10L, null, 1L, "next");
        Comment third = comment(3L, 10L, null, 1L, "older");
        when(comments.findByProjectIdAndWorkItemIdIsNullOrderByCreatedAtDescIdDesc(any(), any()))
                .thenReturn(List.of(first, second), List.of(third));
        when(users.findById(1L)).thenReturn(Optional.empty());

        assertThat(service.listProject(10L, 1L, 2, 1)).extracting(r -> r.content()).containsExactly("next", "older");
        verify(comments).findByProjectIdAndWorkItemIdIsNullOrderByCreatedAtDescIdDesc(10L, PageRequest.of(0, 2));
        verify(comments).findByProjectIdAndWorkItemIdIsNullOrderByCreatedAtDescIdDesc(10L, PageRequest.of(1, 2));
    }

    @Test
    void onlyAuthorMayEditAndUpdateRecordsActivity() throws Exception {
        Comment comment = comment(7L, 10L, null, 4L, "old");
        when(comments.findById(7L)).thenReturn(Optional.of(comment));
        when(auth.canView(9L, 10L)).thenReturn(true);
        // User 9 is NOT the author but DOES hold COMMENT_CREATE, so the rejection
        // below can only come from the author check — without this stub the
        // earlier requireCreate gate would throw first and the assertion would
        // no longer prove anything about authorship.
        when(auth.hasPermission(9L, 10L, Permission.COMMENT_CREATE)).thenReturn(true);
        assertThatThrownBy(() -> service.update(7L, new CommentUpdateRequest("no"), 9L))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(comment.getContent()).isEqualTo("old");

        when(auth.canView(4L, 10L)).thenReturn(true);
        when(auth.hasPermission(4L, 10L, Permission.COMMENT_CREATE)).thenReturn(true);
        var response = service.update(7L, new CommentUpdateRequest("new"), 4L);
        assertThat(response.content()).isEqualTo("new");
        verify(activity).record(10L, 4L, com.flowpilot.entity.ActivityEventType.COMMENT_UPDATED,
                "Comentario actualizado", "{\"commentId\":7}");
    }

    @Test
    void authorWithoutCommentCreatePermissionCannotEditOwnComment() throws Exception {
        Comment comment = comment(7L, 10L, null, 4L, "old");
        when(comments.findById(7L)).thenReturn(Optional.of(comment));
        when(auth.canView(4L, 10L)).thenReturn(true);
        when(auth.hasPermission(4L, 10L, Permission.COMMENT_CREATE)).thenReturn(false);

        assertThatThrownBy(() -> service.update(7L, new CommentUpdateRequest("new"), 4L))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(comment.getContent()).isEqualTo("old");
        verify(activity, org.mockito.Mockito.never()).record(any(), any(), any(), any(), any());
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

    @Test
    void onlyAuthorMayDeleteAndDeleteRecordsActivity() throws Exception {
        Comment comment = comment(7L, 10L, null, 4L, "old");
        when(comments.findById(7L)).thenReturn(Optional.of(comment));
        when(auth.canView(9L, 10L)).thenReturn(true);
        assertThatThrownBy(() -> service.delete(7L, 9L)).isInstanceOf(AccessDeniedException.class);
        verify(comments, org.mockito.Mockito.never()).delete(any());

        when(auth.canView(4L, 10L)).thenReturn(true);
        service.delete(7L, 4L);
        verify(comments).delete(comment);
        verify(activity).record(10L, 4L, com.flowpilot.entity.ActivityEventType.COMMENT_DELETED,
                "Comentario eliminado", "{\"commentId\":7}");
    }

    @Test
    void deletingAMissingCommentThrowsNotFound() {
        when(comments.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.delete(404L, 1L))
                .isInstanceOf(com.flowpilot.exception.CommentNotFoundException.class);
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
