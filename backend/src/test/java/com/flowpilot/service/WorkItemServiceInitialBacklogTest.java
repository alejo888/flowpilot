package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.BacklogEpicRequest;
import com.flowpilot.dto.BacklogStoryRequest;
import com.flowpilot.entity.ActivityEventType;
import com.flowpilot.entity.BoardColumn;
import com.flowpilot.entity.WorkItem;
import com.flowpilot.exception.BoardColumnNotFoundException;
import com.flowpilot.repository.BoardColumnRepository;
import com.flowpilot.repository.SprintRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.repository.WorkItemRepository;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** {@link WorkItemService#createInitialBacklog}: epics + stories for a brand-new project. */
@ExtendWith(MockitoExtension.class)
class WorkItemServiceInitialBacklogTest {

    @Mock
    private WorkItemRepository workItemRepository;

    @Mock
    private BoardColumnRepository boardColumnRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SprintRepository sprintRepository;

    private ProjectActivityService activityService;
    private WorkItemService workItemService;

    @BeforeEach
    void setUp() {
        ProjectAuthorizationService authorizationService = mock(ProjectAuthorizationService.class);
        activityService = mock(ProjectActivityService.class);
        workItemService = new WorkItemService(
                workItemRepository, boardColumnRepository, userRepository, authorizationService, sprintRepository);
        workItemService.setActivityService(activityService);
    }

    private List<WorkItem> stubSaves() {
        AtomicLong ids = new AtomicLong(100);
        List<WorkItem> saved = new ArrayList<>();
        when(workItemRepository.save(any(WorkItem.class))).thenAnswer(invocation -> {
            WorkItem item = invocation.getArgument(0);
            Field field = WorkItem.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(item, ids.incrementAndGet());
            saved.add(item);
            return item;
        });
        return saved;
    }

    private void stubFirstColumn() throws Exception {
        BoardColumn column = new BoardColumn(10L, "Por hacer", 1024);
        Field field = BoardColumn.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(column, 200L);
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L)).thenReturn(Optional.of(column));
    }

    @Test
    void createsEpicsWithoutParentAndStoriesUnderThemInOrderWithSequentialPositions() throws Exception {
        stubFirstColumn();
        List<WorkItem> saved = stubSaves();

        workItemService.createInitialBacklog(10L, 7L,
                List.of(
                        new BacklogEpicRequest("Epic A", "desc A",
                                List.of(new BacklogStoryRequest("A1", null), new BacklogStoryRequest("A2", "d"))),
                        new BacklogEpicRequest("Epic B", null, List.of(new BacklogStoryRequest("B1", null)))),
                true, "llama3");

        assertThat(saved).extracting(WorkItem::getTitle).containsExactly("Epic A", "A1", "A2", "Epic B", "B1");
        assertThat(saved).extracting(WorkItem::getParentWorkItemId)
                .containsExactly(null, 101L, 101L, null, 104L);
        assertThat(saved).extracting(WorkItem::getPosition).containsExactly(1024, 2048, 3072, 4096, 5120);
        assertThat(saved).allSatisfy(i -> {
            assertThat(i.getColumnId()).isEqualTo(200L);
            assertThat(i.getProjectId()).isEqualTo(10L);
            assertThat(i.getSprintId()).isNull();
            assertThat(i.getAssignedUserId()).isNull();
            assertThat(i.isAiGenerated()).isTrue();
            assertThat(i.getAiModel()).isEqualTo("llama3");
            assertThat(i.getAcceptanceCriteria()).isEmpty();
        });
    }

    @Test
    void recordsOneWorkItemCreatedActivityPerItemWithSpanishText() throws Exception {
        stubFirstColumn();
        stubSaves();

        workItemService.createInitialBacklog(10L, 7L,
                List.of(new BacklogEpicRequest("Epic A", null, List.of(new BacklogStoryRequest("A1", null)))),
                null, null);

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(activityService, times(2)).record(
                eq(10L), eq(7L), eq(ActivityEventType.WORK_ITEM_CREATED), text.capture(), eq("{}"));
        assertThat(text.getAllValues()).containsExactly("Se creó la tarea \"Epic A\"", "Se creó la tarea \"A1\"");
    }

    @Test
    void aiGeneratedFalseStillStoresTheClientSuppliedModel() throws Exception {
        // Same convention as create/createBatch: the model is stored as sent, independent of the flag.
        stubFirstColumn();
        List<WorkItem> saved = stubSaves();

        workItemService.createInitialBacklog(10L, 7L,
                List.of(new BacklogEpicRequest("Epic A", null, List.of())), false, "llama3");

        assertThat(saved.get(0).isAiGenerated()).isFalse();
        assertThat(saved.get(0).getAiModel()).isEqualTo("llama3");
    }

    @Test
    void aiGeneratedNullStillStoresTheClientSuppliedModel() throws Exception {
        stubFirstColumn();
        List<WorkItem> saved = stubSaves();

        workItemService.createInitialBacklog(10L, 7L,
                List.of(new BacklogEpicRequest("Epic A", null, List.of())), null, "llama3");

        assertThat(saved.get(0).isAiGenerated()).isFalse();
        assertThat(saved.get(0).getAiModel()).isEqualTo("llama3");
    }

    @Test
    void nullProvenanceStoresNotAiGenerated() throws Exception {
        stubFirstColumn();
        List<WorkItem> saved = stubSaves();

        workItemService.createInitialBacklog(10L, 7L,
                List.of(new BacklogEpicRequest("Epic A", null, List.of())), null, null);

        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).isAiGenerated()).isFalse();
        assertThat(saved.get(0).getAiModel()).isNull();
    }

    @Test
    void emptyEpicListCreatesNothingAndSkipsTheColumnLookup() {
        workItemService.createInitialBacklog(10L, 7L, List.of(), true, "m");

        verify(workItemRepository, never()).save(any());
        verify(boardColumnRepository, never()).findFirstByProjectIdOrderByPositionAsc(any());
    }

    @Test
    void missingFirstColumnThrows() {
        when(boardColumnRepository.findFirstByProjectIdOrderByPositionAsc(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> workItemService.createInitialBacklog(10L, 7L,
                List.of(new BacklogEpicRequest("E", null, List.of())), null, null))
                .isInstanceOf(BoardColumnNotFoundException.class);
    }
}
