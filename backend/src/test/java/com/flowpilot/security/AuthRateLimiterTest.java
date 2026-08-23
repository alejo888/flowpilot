package com.flowpilot.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.flowpilot.exception.TooManyRequestsException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthRateLimiterTest {

    private static Clock fixedClock() {
        return Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
    }

    // --- client IP resolution behind the single nginx hop -------------------

    @Test
    void resolveClientIpPrefersRealIpOverForwardedForBecauseNginxOverwritesRealIpButAppendsToForwardedFor() {
        // A spoofing attempt: the caller pre-supplies its own X-Forwarded-For
        // entry, but nginx's `X-Real-IP $remote_addr` cannot be forged the
        // same way, so it must win.
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.18.0.4"); // the nginx container
        request.addHeader("X-Forwarded-For", "203.0.113.9, 172.18.0.4");
        request.addHeader("X-Real-IP", "172.18.0.4");

        assertThat(AuthRateLimiter.resolveClientIp(request)).isEqualTo("172.18.0.4");
    }

    @Test
    void resolveClientIpFallsBackToForwardedForThenRemoteAddrWhenRealIpIsAbsent() {
        MockHttpServletRequest withForwardedFor = new MockHttpServletRequest();
        withForwardedFor.setRemoteAddr("172.18.0.4");
        withForwardedFor.addHeader("X-Forwarded-For", "203.0.113.9, 172.18.0.4");
        assertThat(AuthRateLimiter.resolveClientIp(withForwardedFor)).isEqualTo("203.0.113.9");

        MockHttpServletRequest direct = new MockHttpServletRequest();
        direct.setRemoteAddr("192.0.2.1");
        assertThat(AuthRateLimiter.resolveClientIp(direct)).isEqualTo("192.0.2.1");
    }

    @Test
    void resolveClientIpDoesNotCrashOnAMalformedForwardedForHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.0.2.1");
        request.addHeader("X-Forwarded-For", ",");

        assertThat(AuthRateLimiter.resolveClientIp(request)).isEqualTo("192.0.2.1");
    }

    @Test
    void differentForwardedClientsGetIndependentIpBudgets() {
        AuthRateLimiter limiter = new AuthRateLimiter(fixedClock());

        for (int attempt = 0; attempt < AuthRateLimiter.MAX_ATTEMPTS_PER_IP; attempt++) {
            limiter.countAttemptOrReject(AuthRateLimiter.LOGIN, "203.0.113.9", "victim" + attempt + "@flowpilot.local");
        }
        assertThatThrownBy(() -> limiter.countAttemptOrReject(
                        AuthRateLimiter.LOGIN, "203.0.113.9", "other@flowpilot.local"))
                .isInstanceOf(TooManyRequestsException.class);

        // A different real client is unaffected — this is what the proxy-aware
        // IP resolution buys: no single global bucket for all users.
        assertThatCode(() -> limiter.countAttemptOrReject(
                        AuthRateLimiter.LOGIN, "198.51.100.7", "other@flowpilot.local"))
                .doesNotThrowAnyException();
    }

    // --- atomicity ----------------------------------------------------------

    @Test
    void concurrentBurstCannotExceedTheIpLimit() throws Exception {
        AuthRateLimiter limiter = new AuthRateLimiter(fixedClock());
        int threads = 32;
        AtomicInteger admitted = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        ExecutorService pool = Executors.newFixedThreadPool(threads);

        try {
            for (int i = 0; i < threads; i++) {
                int index = i;
                pool.execute(() -> {
                    try {
                        start.await();
                        limiter.countAttemptOrReject(
                                AuthRateLimiter.LOGIN, "203.0.113.9", "victim" + index + "@flowpilot.local");
                        admitted.incrementAndGet();
                    } catch (TooManyRequestsException ignored) {
                        // expected for everything above the cap
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } finally {
                        done.countDown();
                    }
                });
            }
            start.countDown();
            assertThat(done.await(10, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }

        assertThat(admitted.get()).isEqualTo(AuthRateLimiter.MAX_ATTEMPTS_PER_IP);
    }

    // --- reset scope --------------------------------------------------------

    @Test
    void resetAccountClearsOnlyTheAccountCounterNotTheSharedIpCounter() {
        AuthRateLimiter limiter = new AuthRateLimiter(fixedClock());
        String attackerIp = "203.0.113.9";

        for (int attempt = 0; attempt < AuthRateLimiter.MAX_ATTEMPTS_PER_IP; attempt++) {
            limiter.countAttemptOrReject(AuthRateLimiter.LOGIN, attackerIp, "victim" + attempt + "@flowpilot.local");
        }

        // The attacker "logs in" successfully with their own account.
        limiter.resetAccount(AuthRateLimiter.LOGIN, "attacker@flowpilot.local");

        // The shared IP budget must survive that success.
        assertThatThrownBy(() -> limiter.ensureWithinLimit(
                        AuthRateLimiter.LOGIN, attackerIp, "next-victim@flowpilot.local"))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void resetAccountClearsTheOwnAccountCounterSoLegitimateUsersAreNotLockedOut() {
        AuthRateLimiter limiter = new AuthRateLimiter(fixedClock());

        for (int attempt = 0; attempt < AuthRateLimiter.MAX_ATTEMPTS_PER_ACCOUNT; attempt++) {
            limiter.countAttemptOrReject(AuthRateLimiter.LOGIN, null, "ada@flowpilot.local");
        }
        assertThatThrownBy(() -> limiter.ensureWithinLimit(AuthRateLimiter.LOGIN, null, "ada@flowpilot.local"))
                .isInstanceOf(TooManyRequestsException.class);

        limiter.resetAccount(AuthRateLimiter.LOGIN, "Ada@FlowPilot.Local");

        assertThatCode(() -> limiter.ensureWithinLimit(AuthRateLimiter.LOGIN, null, "ada@flowpilot.local"))
                .doesNotThrowAnyException();
    }

    // --- account vs IP ceilings --------------------------------------------

    @Test
    void accountCeilingIsHigherThanTheIpCeilingSoOneAttackerCannotCheaplyLockAVictimOut() {
        assertThat(AuthRateLimiter.MAX_ATTEMPTS_PER_ACCOUNT).isGreaterThan(AuthRateLimiter.MAX_ATTEMPTS_PER_IP);

        AuthRateLimiter limiter = new AuthRateLimiter(fixedClock());
        String attackerIp = "203.0.113.9";
        String victim = "victim@flowpilot.local";

        for (int attempt = 0; attempt < AuthRateLimiter.MAX_ATTEMPTS_PER_IP; attempt++) {
            limiter.countAttemptOrReject(AuthRateLimiter.LOGIN, attackerIp, victim);
        }
        // The attacker runs out of their own IP budget long before the victim's
        // account budget is exhausted.
        assertThatThrownBy(() -> limiter.countAttemptOrReject(AuthRateLimiter.LOGIN, attackerIp, victim))
                .isInstanceOf(TooManyRequestsException.class);

        // The victim can still log in from their own address.
        assertThatCode(() -> limiter.ensureWithinLimit(AuthRateLimiter.LOGIN, "198.51.100.7", victim))
                .doesNotThrowAnyException();
    }
}
