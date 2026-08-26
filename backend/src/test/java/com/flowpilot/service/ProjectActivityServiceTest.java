package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.ProjectActivity;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.repository.ProjectActivityRepository;
import com.flowpilot.repository.ProjectRepository;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectActivityServiceTest {
    @Mock ProjectActivityRepository repository;
    @Mock ProjectRepository projects;
    @Mock Project project;
    private ProjectActivityService service;

    @BeforeEach
    void setUp() {
        service = new ProjectActivityService(repository, projects);
        lenient().when(projects.findById(10L)).thenReturn(Optional.of(project));
    }

    @Test
    void recordsRepresentativeCommentEvent() {
        service.record(10L, 4L, ActivityEventType.COMMENT_CREATED, "Comment created", "{\"commentId\":7}");
        verify(repository).save(any(ProjectActivity.class));
    }

    @Test
    void mapsNewestFirstEventsWithNonAlignedOffsetAndLimit() throws Exception {
        ProjectActivity newest = activity(1L, "newest");
        ProjectActivity next = activity(2L, "next");
        ProjectActivity older = activity(3L, "older");
        when(repository.findByProjectIdOrderByCreatedAtDescIdDesc(any(), any()))
                .thenReturn(List.of(newest, next), List.of(older));

        var result = service.list(10L, 2, 1);

        assertThat(result).extracting(r -> r.displayText()).containsExactly("next", "older");
        assertThat(result.get(0).eventType()).isEqualTo(ActivityEventType.COMMENT_CREATED);
    }

    @Test
    void listThrowsNotFoundForNonexistentProjectRegardlessOfCaller() {
        when(projects.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.list(999L, 20, 0))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    private ProjectActivity activity(Long id, String text) throws Exception {
        ProjectActivity value = new ProjectActivity(10L, 4L, ActivityEventType.COMMENT_CREATED, text, "{}");
        Field field = ProjectActivity.class.getDeclaredField("id"); field.setAccessible(true); field.set(value, id);
        return value;
    }
}
