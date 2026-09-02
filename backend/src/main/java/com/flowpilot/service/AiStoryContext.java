package com.flowpilot.service;

import com.flowpilot.entity.WorkItem;
import java.util.List;

/**
 * Backend-side story-context composition shared by the AI planning services
 * (spec: ai-acceptance-criteria-generation — design D-B). Extracted verbatim
 * from {@link AiSubtaskService} once a second caller ({@link
 * AiAcceptanceCriteriaService}) needed the identical {@code Título:} /
 * {@code Descripción:} / {@code Criterios de aceptación:} block — the rule of
 * three. The provider never builds this text; it only receives it as content.
 *
 * <p>The acceptance-criteria block is omitted entirely when the list is empty;
 * a blank or absent description becomes {@code (sin descripción)}.
 */
final class AiStoryContext {

    private AiStoryContext() {}

    static String compose(WorkItem item) {
        StringBuilder context = new StringBuilder();
        context.append("Título: ").append(item.getTitle()).append('\n');
        String description = item.getDescription();
        context.append("Descripción: ")
                .append(description == null || description.isBlank() ? "(sin descripción)" : description.strip());
        List<String> criteria = item.getAcceptanceCriteria();
        if (criteria != null && !criteria.isEmpty()) {
            context.append('\n').append("Criterios de aceptación:");
            for (String criterion : criteria) {
                context.append('\n').append("- ").append(criterion);
            }
        }
        return context.toString();
    }
}
