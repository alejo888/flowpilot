package com.flowpilot.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Teaches the springdoc-generated OpenAPI document the same bearer-JWT
 * security the hand-authored {@code api/openapi.yaml} already declares, so the
 * CI oasdiff breaking-change gate ({@code .github/workflows/ci.yml}) compares
 * like with like instead of reporting {@code api-security-removed} on every
 * authenticated operation.
 *
 * <p>Mirrors {@link com.flowpilot.security.SecurityConfig}: every request is
 * authenticated except {@code /api/auth/**} (plus {@code /v3/api-docs/**} and
 * {@code /actuator/health}, which never appear in the API document). The
 * requirement is attached per-operation rather than as a global
 * {@code security} block so the six {@code /api/auth/*} operations stay
 * public, matching the contract exactly.
 */
@Configuration
public class OpenApiConfig {

    static final String BEARER_SCHEME_NAME = "bearerAuth";
    private static final String PUBLIC_PATH_PREFIX = "/api/auth/";

    @Bean
    public OpenApiCustomizer bearerSecurityCustomizer() {
        return openApi -> {
            Components components = openApi.getComponents();
            if (components == null) {
                components = new Components();
                openApi.setComponents(components);
            }
            components.addSecuritySchemes(BEARER_SCHEME_NAME, new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT"));

            if (openApi.getPaths() == null) {
                return;
            }
            openApi.getPaths().forEach((path, pathItem) -> {
                if (path.startsWith(PUBLIC_PATH_PREFIX)) {
                    return;
                }
                pathItem.readOperations().forEach(operation ->
                        operation.addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME_NAME)));
            });
        };
    }
}
