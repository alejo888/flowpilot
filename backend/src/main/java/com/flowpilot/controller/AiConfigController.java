package com.flowpilot.controller;

import com.flowpilot.config.AiSettings;
import com.flowpilot.dto.AiConfigResponse;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reports whether AI-assisted planning is enabled (spec: ai-runtime-config —
 * "Expose AI availability"). Authenticated by {@code SecurityConfig}'s
 * {@code anyRequest().authenticated()} rule; the frontend calls this once after
 * login to show or hide the AI user-story entrypoint.
 *
 * <p>The {@code flowpilot.ai.enabled} value is read only from the {@link
 * AiSettings} bean built by {@link com.flowpilot.config.AiConfig} — this
 * controller never re-reads the property itself.
 */
@RestController
public class AiConfigController {

    private final AiSettings aiSettings;

    public AiConfigController(AiSettings aiSettings) {
        this.aiSettings = aiSettings;
    }

    @Operation(summary = "Report whether AI-assisted planning is enabled")
    @GetMapping("/api/ai/config")
    public AiConfigResponse getAiConfig() {
        return new AiConfigResponse(aiSettings.enabled());
    }
}
