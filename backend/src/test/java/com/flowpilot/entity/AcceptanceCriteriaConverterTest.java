package com.flowpilot.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Pins the JSON round-trip contract for {@link AcceptanceCriteriaConverter}:
 * the DB side is always a non-null JSON array string and the entity side is
 * always a non-null ordered {@code List<String>} (spec: work-items —
 * "Structured acceptance criteria", default empty, never folded into
 * description).
 */
class AcceptanceCriteriaConverterTest {

    private final AcceptanceCriteriaConverter converter = new AcceptanceCriteriaConverter();

    @Test
    void roundTripsAnOrderedListThroughJson() {
        List<String> criteria = List.of("Dado A", "Cuando B", "Entonces C");

        String json = converter.convertToDatabaseColumn(criteria);
        List<String> back = converter.convertToEntityAttribute(json);

        assertThat(json).isEqualTo("[\"Dado A\",\"Cuando B\",\"Entonces C\"]");
        assertThat(back).containsExactly("Dado A", "Cuando B", "Entonces C");
    }

    @Test
    void serialisesAnEmptyListAsAnEmptyJsonArray() {
        assertThat(converter.convertToDatabaseColumn(List.of())).isEqualTo("[]");
    }

    @Test
    void serialisesNullAttributeAsAnEmptyJsonArrayNeverNull() {
        assertThat(converter.convertToDatabaseColumn(null)).isEqualTo("[]");
    }

    @Test
    void deserialisesNullColumnAsAnEmptyListNeverNull() {
        assertThat(converter.convertToEntityAttribute(null)).isEmpty();
    }

    @Test
    void deserialisesBlankColumnAsAnEmptyList() {
        assertThat(converter.convertToEntityAttribute("   ")).isEmpty();
    }

    @Test
    void roundTripsEmbeddedQuotesAccentsAndNewlines() {
        List<String> criteria = List.of(
                "Dado un usuario con permiso \"WORKITEM_CREATE\"",
                "Cuando envía una acción con acentos: á é í ó ú ñ",
                "Entonces la respuesta\ntiene varias líneas");

        List<String> back = converter.convertToEntityAttribute(converter.convertToDatabaseColumn(criteria));

        assertThat(back).isEqualTo(criteria);
    }
}
