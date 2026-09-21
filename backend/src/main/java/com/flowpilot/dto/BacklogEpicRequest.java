package com.flowpilot.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * One epic of a {@link ProjectWithBacklogRequest}: a parentless work item
 * followed by its stories. {@code stories} may be empty and is never {@code null}.
 */
public record BacklogEpicRequest(
        @NotBlank(message = "El título no puede estar vacío")
        @Size(max = 255, message = "El título no puede superar los 255 caracteres") String title,
        String description,
        @Size(max = 10, message = "Una épica no puede tener más de 10 historias")
        @Valid List<BacklogStoryRequest> stories) {

    public BacklogEpicRequest {
        stories = stories == null ? List.of() : List.copyOf(stories);
    }
}
