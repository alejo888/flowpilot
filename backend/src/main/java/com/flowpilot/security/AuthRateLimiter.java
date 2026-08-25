package com.flowpilot.security;

import com.flowpilot.exception.TooManyRequestsException;
import com.flowpilot.service.EmailNormalizer;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * MVP-grade, in-memory fixed-window throttle for the two unauthenticated,
 * abuse-prone auth endpoints: {@code /api/auth/login} (password guessing) and
 * {@code /api/auth/forgot-password} (unauthenticated reset-token creation).
 *
 * <p>Deliberately dependency-free (no Redis, no external service): a
 * {@link ConcurrentHashMap} of fixed windows keyed by client IP and by
 * normalized account email, with lazy eviction of stale windows. State is
 * per-instance, so it does not survive a restart and does not coordinate across
 * replicas — acceptable for this single-instance portfolio deployment.
 *
 * <p>Login only counts <em>failed</em> attempts (a successful login clears the
 * <em>account</em> counter), so normal usage is never throttled while brute
 * forcing is. A successful login deliberately does <em>not</em> clear the
 * IP-scoped counter: otherwise anyone holding a single valid credential could
 * spray passwords across many victim accounts and then wipe the shared IP
 * budget by logging into their own account.
 *
 * <p>The account-scoped ceiling ({@link #MAX_ATTEMPTS_PER_ACCOUNT}) is
 * deliberately much higher than the IP-scoped one
 * ({@link #MAX_ATTEMPTS_PER_IP}): the account key is derived from
 * attacker-controlled, unauthenticated input (the submitted email), so a low
 * account ceiling would let anybody lock a known victim out of login and
 * forgot-password. An attacker trying to burn the victim's account budget from
 * a single origin exhausts their own, much lower, IP budget first.
 */
@Component
public class AuthRateLimiter {

    public static final String LOGIN = "login";
    public static final String FORGOT_PASSWORD = "forgot-password";
    public static final String CHANGE_PASSWORD = "change-password";

    static final int MAX_ATTEMPTS_PER_IP = 5;
    static final int MAX_ATTEMPTS_PER_ACCOUNT = 15;
    static final int MAX_ATTEMPTS_PER_USER = 5;
    static final long WINDOW_MILLIS = 60_000L;

    private static final String FORWARDED_FOR = "X-Forwarded-For";
    private static final String REAL_IP = "X-Real-IP";
    private static final int EVICTION_THRESHOLD = 10_000;

    private final Clock clock;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public AuthRateLimiter() {
        this(Clock.systemUTC());
    }

    AuthRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Resolves the originating client IP behind the single reverse-proxy hop this
     * app ships with.
     *
     * <p>Per {@code docker-compose.yml} and {@code frontend/nginx.conf}, browsers
     * only ever reach the API through the nginx container, which proxies
     * {@code /api/} to the backend and sets {@code X-Forwarded-For} /
     * {@code X-Real-IP}. Using {@code getRemoteAddr()} alone would therefore key
     * every real user on the nginx container's IP, collapsing the "per-IP" limit
     * into one global bucket that any single abuser could saturate for everyone.
     *
     * <p>{@code X-Real-IP} is preferred over {@code X-Forwarded-For}: nginx's
     * {@code proxy_set_header X-Real-IP $remote_addr} unconditionally
     * overwrites that header with the actual TCP peer, while
     * {@code proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for}
     * <em>appends</em> to whatever the client already sent — so a caller can
     * freely forge a leading {@code X-Forwarded-For} entry through the
     * ordinary public ingress (no direct {@code :8080} access needed) to evade
     * its own IP budget or, worse, spoof a victim's IP and exhaust their
     * budget instead. {@code X-Forwarded-For} is kept only as a fallback for
     * a request that reaches the backend without going through this nginx
     * (e.g. the direct {@code :8080} port in local/dev use), where no
     * trustworthy header exists at all; that residual gap is an accepted MVP
     * tradeoff, not the common case.
     */
    public static String resolveClientIp(HttpServletRequest request) {
        String realIp = request.getHeader(REAL_IP);
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String forwardedFor = request.getHeader(FORWARDED_FOR);
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] parts = forwardedFor.split(",", -1);
            String originating = parts[0].trim();
            if (!originating.isEmpty()) {
                return originating;
            }
        }
        return request.getRemoteAddr();
    }

    /**
     * Read-only pre-authentication gate: throws {@link TooManyRequestsException}
     * when any scope already reached its limit. Used before expensive work
     * (bcrypt) for login, where only failures may count.
     */
    public void ensureWithinLimit(String action, String clientIp, String email) {
        long now = clock.millis();
        evictStaleIfCrowded(now);
        for (Scope scope : scopes(action, clientIp, email)) {
            Window window = windows.get(scope.key());
            if (window != null && !window.isExpired(now) && window.count() >= scope.limit()) {
                throw new TooManyRequestsException();
            }
        }
    }

    /**
     * Atomically counts one attempt against every scope and rejects when the
     * resulting count exceeds that scope's limit.
     *
     * <p>Increment and check happen in a single {@link ConcurrentHashMap#compute}
     * step per key, so a concurrent burst cannot slip past a stale read: every
     * request that makes the counter exceed the limit is rejected, even the ones
     * that passed {@link #ensureWithinLimit} before any of them recorded.
     */
    public void countAttemptOrReject(String action, String clientIp, String email) {
        long now = clock.millis();
        evictStaleIfCrowded(now);
        boolean exceeded = false;
        for (Scope scope : scopes(action, clientIp, email)) {
            Window window = windows.compute(scope.key(), (ignored, existing) ->
                    (existing == null || existing.isExpired(now))
                            ? new Window(now, 1)
                            : new Window(existing.start(), existing.count() + 1));
            if (window.count() > scope.limit()) {
                exceeded = true;
            }
        }
        if (exceeded) {
            throw new TooManyRequestsException();
        }
    }

    /**
     * Clears only the account-scoped counter after that account authenticated
     * successfully. The IP-scoped counter is intentionally left alone: it must
     * decay by its own time window only, never through an unrelated success.
     */
    public void resetAccount(String action, String email) {
        if (email != null && !email.isBlank()) {
            windows.remove(accountKey(action, email));
        }
    }

    /**
     * User-keyed variant of {@link #ensureWithinLimit}, for AUTHENTICATED
     * endpoints where an IP or email key makes no sense (a caller acting on
     * their own account, e.g. {@code PUT /api/users/me/password}'s
     * {@code currentPassword} verification oracle): keying by IP would let
     * many accounts behind one NAT/proxy share a budget, and keying by email
     * doesn't apply since no email is submitted on that request.
     */
    public void ensureUserWithinLimit(String action, Long userId) {
        long now = clock.millis();
        evictStaleIfCrowded(now);
        Scope scope = userScope(action, userId);
        Window window = windows.get(scope.key());
        if (window != null && !window.isExpired(now) && window.count() >= scope.limit()) {
            throw new TooManyRequestsException();
        }
    }

    /** User-keyed variant of {@link #countAttemptOrReject}. */
    public void countUserAttemptOrReject(String action, Long userId) {
        long now = clock.millis();
        evictStaleIfCrowded(now);
        Scope scope = userScope(action, userId);
        Window window = windows.compute(scope.key(), (ignored, existing) ->
                (existing == null || existing.isExpired(now))
                        ? new Window(now, 1)
                        : new Window(existing.start(), existing.count() + 1));
        if (window.count() > scope.limit()) {
            throw new TooManyRequestsException();
        }
    }

    /** User-keyed variant of {@link #resetAccount}. */
    public void resetUser(String action, Long userId) {
        if (userId != null) {
            windows.remove(userScope(action, userId).key());
        }
    }

    private Scope userScope(String action, Long userId) {
        return new Scope(action + "|user|" + userId, MAX_ATTEMPTS_PER_USER);
    }

    private List<Scope> scopes(String action, String clientIp, String email) {
        List<Scope> scopes = new ArrayList<>(2);
        if (clientIp != null && !clientIp.isBlank()) {
            scopes.add(new Scope(action + "|ip|" + clientIp, MAX_ATTEMPTS_PER_IP));
        }
        if (email != null && !email.isBlank()) {
            scopes.add(new Scope(accountKey(action, email), MAX_ATTEMPTS_PER_ACCOUNT));
        }
        return scopes;
    }

    private String accountKey(String action, String email) {
        return action + "|account|" + EmailNormalizer.normalize(email);
    }

    private void evictStaleIfCrowded(long now) {
        if (windows.size() < EVICTION_THRESHOLD) {
            return;
        }
        windows.values().removeIf(window -> window.isExpired(now));
    }

    private record Scope(String key, int limit) {
    }

    private record Window(long start, int count) {
        boolean isExpired(long now) {
            return now - start >= WINDOW_MILLIS;
        }
    }
}
