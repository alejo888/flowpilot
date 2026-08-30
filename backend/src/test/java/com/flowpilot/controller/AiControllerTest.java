package com.flowpilot.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import com.flowpilot.dto.UserStoryDraft;
import com.flowpilot.exception.AiGenerationException;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.security.JwtService;
import com.flowpilot.security.SecurityConfig;
import com.flowpilot.service.AiUserStoryService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Slice test for {@code POST /api/projects/{projectId}/ai/user-stories} (spec:
 * ai-user-story-generation). Runs through the real {@link SecurityConfig} filter
 * chain with a mocked {@link AiUserStoryService}: the controller carries no
 * authorization logic, so 403/404/503 all arrive as exceptions the service
 * raises and {@link com.flowpilot.exception.GlobalExceptionHandler} maps to
 * Spanish {@code application/problem+json}. 400 is bean-validation on the body;
 * 401 is the anonymous-request gate.
 */
@WebMvcTest(AiController.class)
@Import(SecurityConfig.class)
class AiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AiUserStoryService aiUserStoryService;

    @MockitoBean
    private JwtService jwtService;

    private static final long PROJECT_ID = 10L;
    private static final long CALLER_ID = 7L;

    private static RequestPostProcessor caller() {
        return authentication(new UsernamePasswordAuthenticationToken(String.valueOf(CALLER_ID), null, List.of()));
    }

    private static GeneratedUserStoryResponse sampleDraft() {
        return new GeneratedUserStoryResponse(
                new UserStoryDraft(
                        "usuario del equipo",
                        "exportar los informes a PDF",
                        "compartirlos con clientes",
                        "Como usuario del equipo quiero exportar los informes a PDF para compartirlos con clientes"),
                List.of(
                        "Dado un informe cuando pulso exportar entonces se descarga un PDF",
                        "Dado un informe vacío cuando pulso exportar entonces veo un aviso"),
                AiProvider.STUB,
                null);
    }

    @Test
    void generatesDraftAndReturns200WithComposedSentence() throws Exception {
        when(aiUserStoryService.generate(eq(PROJECT_ID), eq("Necesito exportar informes a PDF"), eq(CALLER_ID)))
                .thenReturn(sampleDraft());

        mockMvc.perform(post("/api/projects/{projectId}/ai/user-stories", PROJECT_ID)
                        .with(caller())
                        .contentType("application/json")
                        .content("{\"requirement\":\"Necesito exportar informes a PDF\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userStory.text").value(
                        "Como usuario del equipo quiero exportar los informes a PDF para compartirlos con clientes"))
                .andExpect(jsonPath("$.acceptanceCriteria.length()").value(2))
                .andExpect(jsonPath("$.acceptanceCriteria[0]").value(
                        "Dado un informe cuando pulso exportar entonces se descarga un PDF"))
                .andExpect(jsonPath("$.generatedBy").value("STUB"))
                .andExpect(jsonPath("$.model").doesNotExist());
    }

    @Test
    void requirementLongerThan2000CharsReturns400AndDoesNotCallTheService() throws Exception {
        String tooLong = "a".repeat(2001);

        mockMvc.perform(post("/api/projects/{projectId}/ai/user-stories", PROJECT_ID)
                        .with(caller())
                        .contentType("application/json")
                        .content("{\"requirement\":\"" + tooLong + "\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(aiUserStoryService);
    }

    @Test
    void callerWithoutWorkitemCreateReturns403Spanish() throws Exception {
        when(aiUserStoryService.generate(eq(PROJECT_ID), org.mockito.ArgumentMatchers.anyString(), eq(CALLER_ID)))
                .thenThrow(new AccessDeniedException("Falta el permiso WORKITEM_CREATE en el proyecto 10"));

        mockMvc.perform(post("/api/projects/{projectId}/ai/user-stories", PROJECT_ID)
                        .with(caller())
                        .contentType("application/json")
                        .content("{\"requirement\":\"Necesito exportar informes\"}"))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("Falta el permiso WORKITEM_CREATE en el proyecto 10"));
    }

    @Test
    void unknownProjectReturns404Spanish() throws Exception {
        when(aiUserStoryService.generate(eq(99L), org.mockito.ArgumentMatchers.anyString(), eq(CALLER_ID)))
                .thenThrow(new ProjectNotFoundException(99L));

        mockMvc.perform(post("/api/projects/{projectId}/ai/user-stories", 99L)
                        .with(caller())
                        .contentType("application/json")
                        .content("{\"requirement\":\"Necesito exportar informes\"}"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void aiGenerationFailureReturns503WithSpanishDetail() throws Exception {
        when(aiUserStoryService.generate(eq(PROJECT_ID), org.mockito.ArgumentMatchers.anyString(), eq(CALLER_ID)))
                .thenThrow(new AiGenerationException("connection refused"));

        mockMvc.perform(post("/api/projects/{projectId}/ai/user-stories", PROJECT_ID)
                        .with(caller())
                        .contentType("application/json")
                        .content("{\"requirement\":\"Necesito exportar informes\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.detail").value("El asistente de IA no está disponible en este momento."));
    }

    @Test
    void unauthenticatedRequestReturns401() throws Exception {
        mockMvc.perform(post("/api/projects/{projectId}/ai/user-stories", PROJECT_ID)
                        .contentType("application/json")
                        .content("{\"requirement\":\"Necesito exportar informes\"}"))
                .andExpect(status().isUnauthorized());

        verify(aiUserStoryService, never()).generate(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyLong());
    }
}
