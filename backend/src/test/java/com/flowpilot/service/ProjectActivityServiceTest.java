package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.ProjectActivity;
import com.flowpilot.repository.ProjectActivityRepository;
import java.lang.reflect.Field;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectActivityServiceTest {
    @Mock ProjectActivityRepository repository;
    private ProjectActivityService service;

    @BeforeEach
    void setUp() { service = new ProjectActivityService(repository); }

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

    private ProjectActivity activity(Long id, String text) throws Exception {
        ProjectActivity value = new ProjectActivity(10L, 4L, ActivityEventType.COMMENT_CREATED, text, "{}");
        Field field = ProjectActivity.class.getDeclaredField("id"); field.setAccessible(true); field.set(value, id);
        return value;
    }
}
