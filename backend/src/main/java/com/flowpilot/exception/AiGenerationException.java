package com.flowpilot.exception;

/**
 * Raised by {@link com.flowpilot.service.OllamaAiPlanningService} for every
 * AI-generation failure mode (spec: ai-user-story-generation — "LLM
 * unreachable/slow/non-2xx -&gt; 503" and "Malformed model output -&gt; 503"):
 * connection refused, connect/read timeout, non-2xx response, or output that
 * cannot be parsed into a complete user story. No retry is attempted.
 *
 * <p>{@link GlobalExceptionHandler} maps this to HTTP 503 RFC 7807 with the
 * Spanish detail {@code "El asistente de IA no está disponible en este
 * momento."} — the cause message is never leaked to the client.
 */
public class AiGenerationException extends RuntimeException {

    public AiGenerationException(String message) {
        super(message);
    }

    public AiGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
