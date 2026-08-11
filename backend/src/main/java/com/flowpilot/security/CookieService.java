package com.flowpilot.security;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

/**
 * Builds the HttpOnly/Secure/SameSite=Lax refresh cookie (design decision D4)
 * and the readable-by-JS {@code XSRF-TOKEN} companion cookie used by the
 * double-submit CSRF pattern (design decision D8) on the two
 * cookie-authenticated endpoints, {@code /api/auth/refresh} and
 * {@code /api/auth/logout}.
 */
@Service
public class CookieService {

    public static final String COOKIE_NAME = "refreshToken";
    public static final String CSRF_COOKIE_NAME = "XSRF-TOKEN";
    private static final String COOKIE_PATH = "/api/auth";
    private static final String CSRF_COOKIE_PATH = "/";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final long refreshTokenTtlDays;

    public CookieService(@Value("${flowpilot.jwt.refresh-token-ttl-days}") long refreshTokenTtlDays) {
        this.refreshTokenTtlDays = refreshTokenTtlDays;
    }

    public ResponseCookie buildRefreshCookie(String rawToken) {
        return ResponseCookie.from(COOKIE_NAME, rawToken)
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(Duration.ofDays(refreshTokenTtlDays))
                .build();
    }

    public ResponseCookie buildClearCookie() {
        return ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build();
    }

    /** Generates a fresh opaque CSRF token; not persisted, only echoed back via the double-submit cookie. */
    public String generateCsrfToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Builds the readable-by-JS {@code XSRF-TOKEN} cookie the Angular frontend
     * reads and echoes back as the {@code X-XSRF-TOKEN} header on
     * refresh/logout requests. Deliberately NOT HttpOnly.
     */
    public ResponseCookie buildCsrfCookie(String csrfToken) {
        return ResponseCookie.from(CSRF_COOKIE_NAME, csrfToken)
                .httpOnly(false)
                .secure(true)
                .sameSite("Lax")
                .path(CSRF_COOKIE_PATH)
                .maxAge(Duration.ofDays(refreshTokenTtlDays))
                .build();
    }

    public ResponseCookie buildClearCsrfCookie() {
        return ResponseCookie.from(CSRF_COOKIE_NAME, "")
                .httpOnly(false)
                .secure(true)
                .sameSite("Lax")
                .path(CSRF_COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build();
    }
}
