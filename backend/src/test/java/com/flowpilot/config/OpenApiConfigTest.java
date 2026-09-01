package com.flowpilot.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.junit.jupiter.api.Test;
import org.springdoc.core.customizers.OpenApiCustomizer;

/**
 * Unit-level coverage for the springdoc security customizer. The end-to-end
 * proof (the live {@code /v3/api-docs} document actually carrying the scheme
 * and matching {@code api/openapi.yaml}) is the CI oasdiff step; this test
 * pins the customizer's own behaviour without a Spring context.
 */
class OpenApiConfigTest {

    private final OpenApiCustomizer customizer = new OpenApiConfig().bearerSecurityCustomizer();

    private static OpenAPI specWithPaths(String... paths) {
        Paths container = new Paths();
        for (String path : paths) {
            container.addPathItem(path, new PathItem().get(new Operation()).post(new Operation()));
        }
        return new OpenAPI().components(new Components()).paths(container);
    }

    @Test
    void registersTheBearerJwtSecurityScheme() {
        OpenAPI openApi = specWithPaths("/api/projects");

        customizer.customise(openApi);

        SecurityScheme scheme = openApi.getComponents().getSecuritySchemes().get("bearerAuth");
        assertThat(scheme).isNotNull();
        assertThat(scheme.getType()).isEqualTo(SecurityScheme.Type.HTTP);
        assertThat(scheme.getScheme()).isEqualTo("bearer");
        assertThat(scheme.getBearerFormat()).isEqualTo("JWT");
    }

    @Test
    void requiresBearerAuthOnEveryNonAuthOperation() {
        OpenAPI openApi = specWithPaths("/api/projects", "/api/work-items/{id}", "/api/ai/config");

        customizer.customise(openApi);

        openApi.getPaths().values().forEach(pathItem ->
                pathItem.readOperations().forEach(operation ->
                        assertThat(operation.getSecurity())
                                .as("security on %s", operation)
                                .isNotNull()
                                .anySatisfy(requirement -> assertThat(requirement).containsKey("bearerAuth"))));
    }

    @Test
    void leavesAuthEndpointsPublic() {
        OpenAPI openApi = specWithPaths("/api/auth/login", "/api/auth/refresh", "/api/auth/forgot-password");

        customizer.customise(openApi);

        openApi.getPaths().values().forEach(pathItem ->
                pathItem.readOperations().forEach(operation ->
                        assertThat(operation.getSecurity()).as("auth op stays public").isNull()));
    }

    @Test
    void toleratesASpecThatHasNoComponentsYet() {
        OpenAPI openApi = new OpenAPI().paths(new Paths().addPathItem("/api/projects", new PathItem().get(new Operation())));

        customizer.customise(openApi);

        assertThat(openApi.getComponents().getSecuritySchemes()).containsKey("bearerAuth");
    }
}
