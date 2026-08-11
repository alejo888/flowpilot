package com.flowpilot.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

class CookieServiceTest {

    private CookieService cookieService;

    @BeforeEach
    void setUp() {
        cookieService = new CookieService(7);
    }

    @Test
    void buildRefreshCookieSetsSecureHttpOnlyAttributesAndValue() {
        ResponseCookie cookie = cookieService.buildRefreshCookie("raw-refresh-token-value");

        assertThat(cookie.getName()).isEqualTo("refreshToken");
        assertThat(cookie.getValue()).isEqualTo("raw-refresh-token-value");
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        assertThat(cookie.getPath()).isEqualTo("/api/auth");
        assertThat(cookie.getMaxAge().toDays()).isEqualTo(7);
    }

    @Test
    void buildClearCookieExpiresImmediatelyWithEmptyValue() {
        ResponseCookie cookie = cookieService.buildClearCookie();

        assertThat(cookie.getName()).isEqualTo("refreshToken");
        assertThat(cookie.getValue()).isEmpty();
        assertThat(cookie.getMaxAge().isZero()).isTrue();
    }
}
