package com.flowpilot.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** Null entries in client-supplied backlog lists must be reported by bean validation, never NPE. */
class ProjectWithBacklogRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void init() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void close() {
        factory.close();
    }

    private static ProjectWithBacklogRequest request(List<BacklogEpicRequest> epics) {
        return new ProjectWithBacklogRequest("Apollo", null, null, null, null, null, null, epics, null, null);
    }

    private static List<String> paths(ProjectWithBacklogRequest r) {
        return validator.validate(r).stream().map(v -> v.getPropertyPath().toString()).collect(Collectors.toList());
    }

    @Test
    void nullEpicElementIsConstructibleAndReportedAtItsIndex() {
        ProjectWithBacklogRequest r = request(Arrays.asList((BacklogEpicRequest) null));

        assertThat(paths(r)).anyMatch(p -> p.startsWith("epics[0]"));
    }

    @Test
    void nullStoryElementIsConstructibleAndReportedAtItsIndex() {
        ProjectWithBacklogRequest r = request(List.of(
                new BacklogEpicRequest("x", null, Arrays.asList((BacklogStoryRequest) null))));

        assertThat(paths(r)).anyMatch(p -> p.startsWith("epics[0].stories[0]"));
    }

    @Test
    void totalItemsCheckToleratesNullEntries() {
        List<BacklogEpicRequest> epics = new ArrayList<>();
        epics.add(null);
        epics.add(new BacklogEpicRequest("x", null, Arrays.asList(null, new BacklogStoryRequest("s", null))));

        assertThat(request(epics).isTotalItemsWithinLimit()).isTrue();
    }
}
