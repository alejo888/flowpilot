package com.flowpilot.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Request body for {@code POST /api/projects/with-backlog}: the same project
 * fields (and validation) as {@link ProjectCreateRequest} plus an initial
 * backlog of epics with stories, created atomically with the project.
 * {@code aiGenerated}/{@code aiModel} are batch-level, client-asserted
 * provenance stamped on every created work item.
 */
public record ProjectWithBacklogRequest(
        @NotBlank(message = "El nombre no puede estar vacío")
        @Size(max = 255, message = "El nombre no puede superar los 255 caracteres") String name,
        String description,
        @Size(max = 50, message = "El código no puede superar los 50 caracteres")
        @Pattern(regexp = "^[A-Za-z0-9_-]*$",
                message = "El código solo puede contener letras, dígitos, guion y guion bajo") String code,
        LocalDate startDate,
        LocalDate estimatedEndDate,
        @Size(max = 1000, message = "Las tecnologías no pueden superar los 1000 caracteres") String technologies,
        @Size(max = 500, message = "La URL del repositorio no puede superar los 500 caracteres")
        @Pattern(regexp = "^$|^https?://\\S+$",
                message = "La URL del repositorio debe comenzar con http:// o https://") String repositoryUrl,
        @Size(max = 10, message = "No se pueden crear más de 10 épicas a la vez")
        List<@Valid @NotNull(message = "La épica no puede ser nula") BacklogEpicRequest> epics,
        @Schema(nullable = true) Boolean aiGenerated,
        @Schema(nullable = true)
        @Size(max = 120, message = "El modelo no puede superar los 120 caracteres") String aiModel) {

    /** Hard cap on epics plus stories in one request. */
    public static final int MAX_TOTAL_ITEMS = 50;

    public ProjectWithBacklogRequest {
        epics = epics == null
                ? List.of()
                : Collections.unmodifiableList(new ArrayList<>(epics)); // tolerates null elements; bean validation rejects them
    }

    /** The project-only part, so the existing create logic is reused as is. */
    public ProjectCreateRequest toProjectRequest() {
        return new ProjectCreateRequest(
                name, description, code, startDate, estimatedEndDate, technologies, repositoryUrl);
    }

    @JsonIgnore
    @Schema(hidden = true)
    @AssertTrue(message = "No se pueden crear más de 50 elementos (épicas e historias) a la vez")
    public boolean isTotalItemsWithinLimit() {
        int total = epics.stream()
                .filter(java.util.Objects::nonNull)
                .mapToInt(e -> 1 + e.stories().size())
                .sum();
        return total <= MAX_TOTAL_ITEMS;
    }
}
