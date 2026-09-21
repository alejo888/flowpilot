package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedProjectDraftResponse;
import org.junit.jupiter.api.Test;

/** Stub project draft (vision 7.4): deterministic, offline, {@code model=null}. */
class StubAiPlanningServiceProjectDraftTest {

    private final StubAiPlanningService service = new StubAiPlanningService();

    @Test
    void returnsADeterministicDraftWithAtLeastTwoEpicsOfTwoStoriesAndNoModel() {
        GeneratedProjectDraftResponse first = service.generateProjectDraft("Una tienda en línea de café");
        GeneratedProjectDraftResponse second = service.generateProjectDraft("Una tienda en línea de café");

        assertThat(first.generatedBy()).isEqualTo(AiProvider.STUB);
        assertThat(first.model()).isNull();
        assertThat(first.name()).contains("Una tienda en línea de café");
        assertThat(first.epics()).hasSizeGreaterThanOrEqualTo(2).hasSizeLessThanOrEqualTo(6);
        assertThat(first.epics()).allSatisfy(epic -> {
            assertThat(epic.title()).isNotBlank();
            assertThat(epic.stories()).hasSizeGreaterThanOrEqualTo(2).hasSizeLessThanOrEqualTo(6);
            assertThat(epic.stories()).allSatisfy(story -> assertThat(story.title()).isNotBlank());
        });
        assertThat(first).isEqualTo(second);
    }

    @Test
    void longDescriptionYieldsANameWithinTheProjectNameLimit() {
        GeneratedProjectDraftResponse draft = service.generateProjectDraft("palabra ".repeat(300));

        assertThat(draft.name()).isNotBlank().hasSizeLessThanOrEqualTo(255);
    }

    @Test
    void blankDescriptionStillYieldsAUsableDraft() {
        GeneratedProjectDraftResponse draft = service.generateProjectDraft("   ");

        assertThat(draft.name()).isNotBlank();
        assertThat(draft.epics()).hasSizeGreaterThanOrEqualTo(2);
    }
}
