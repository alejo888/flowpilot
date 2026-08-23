package com.flowpilot.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

/**
 * Enforces the double-submit CSRF pattern (design decision D8) on the two
 * cookie-authenticated endpoints: {@code /api/auth/refresh} and
 * {@code /api/auth/logout} authenticate solely via the HttpOnly refresh
 * cookie, which browsers attach automatically to cross-site requests. Every
 * other endpoint is Bearer-authenticated and CSRF-exempt (a cross-site page
 * cannot read the bearer token to forge it).
 *
 * <p>The Angular frontend reads the readable-by-JS {@code XSRF-TOKEN} cookie
 * (see {@link CookieService#buildCsrfCookie}) and echoes it back as the
 * {@code X-XSRF-TOKEN} header. A cross-site attacker page can trigger the
 * cookie to ride along but cannot read its value to set the matching header.
 */
public class CsrfProtectionFilter extends OncePerRequestFilter {

    private static final String HEADER_NAME = "X-XSRF-TOKEN";
    private static final Set<String> PROTECTED_PATHS = Set.of("/api/auth/refresh", "/api/auth/logout");
    private static final UrlPathHelper PATH_HELPER = UrlPathHelper.defaultInstance;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        if (requiresCsrfCheck(request)) {
            String cookieValue = extractCsrfCookie(request);
            String headerValue = request.getHeader(HEADER_NAME);

            if (cookieValue == null || headerValue == null || !cookieValue.equals(headerValue)) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "Token CSRF ausente o inválido");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Matches on the decoded, context-path-relative path — never on the raw
     * {@code getRequestURI()}. Spring MVC routes on the decoded path within the
     * application, so comparing the raw URI would let a percent-encoded request
     * (e.g. {@code /api/auth/refre%73h}) or any deployment with a non-empty
     * {@code server.servlet.context-path} reach the controller while skipping
     * this check — and this is the only CSRF defense in the app.
     */
    private boolean requiresCsrfCheck(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && PROTECTED_PATHS.contains(PATH_HELPER.getPathWithinApplication(request));
    }

    private String extractCsrfCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (CookieService.CSRF_COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
