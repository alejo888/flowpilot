package com.flowpilot.entity;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/**
 * Maps a work item's ordered {@code List<String>} acceptance criteria to the
 * {@code acceptance_criteria jsonb} column and back (spec: work-items —
 * "Structured acceptance criteria"; design D5 area / confirmed decision:
 * jsonb + {@code AttributeConverter}, not a child table).
 *
 * <p>Both directions are total and never yield {@code null}: a {@code null} or
 * empty attribute serialises to the JSON literal {@code "[]"}, and a {@code
 * null}/blank/unreadable column deserialises to an empty list. Applied
 * explicitly with {@code @Convert} on {@link WorkItem#acceptanceCriteria}
 * ({@code autoApply = false}).
 */
@Converter
public class AcceptanceCriteriaConverter implements AttributeConverter<List<String>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String EMPTY_JSON_ARRAY = "[]";
    private static final TypeReference<List<String>> LIST_OF_STRING = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return EMPTY_JSON_ARRAY;
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalArgumentException("No se pudieron serializar los criterios de aceptación", ex);
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new java.util.ArrayList<>();
        }
        try {
            List<String> parsed = MAPPER.readValue(dbData, LIST_OF_STRING);
            return parsed == null ? new java.util.ArrayList<>() : new java.util.ArrayList<>(parsed);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalArgumentException("No se pudieron leer los criterios de aceptación almacenados", ex);
        }
    }
}
