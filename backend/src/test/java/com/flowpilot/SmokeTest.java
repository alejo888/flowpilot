package com.flowpilot;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Plain JUnit 5 smoke test — no Spring context, no external services.
 * Proves the Maven/Surefire test runner is wired correctly.
 * The full Spring context-loads integration test lives in
 * {@link FlowpilotApplicationTests} and requires Docker (Testcontainers),
 * so it runs in CI, not necessarily in every local dev environment.
 */
class SmokeTest {

    @Test
    void testRunnerIsWired() {
        assertThat(1 + 1).isEqualTo(2);
    }
}
