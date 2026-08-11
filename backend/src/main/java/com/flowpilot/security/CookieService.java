package com.flowpilot.security;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

/**
 * Builds the HttpOnly/Secure/SameSite=Lax refresh cookie (design decision D4).
 * Scoped to {@code /api/auth} so it only rides along on refresh/logout requests.
 */
@Service
public class CookieService {

    public static final String COOKIE_NAME = "refreshToken";
    private static final String COOKIE_PATH = "/api/auth";

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
}
