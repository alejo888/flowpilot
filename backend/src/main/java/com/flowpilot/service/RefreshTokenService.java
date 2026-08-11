package com.flowpilot.service;

import com.flowpilot.entity.RefreshToken;
import com.flowpilot.entity.User;
import com.flowpilot.exception.InvalidRefreshTokenException;
import com.flowpilot.repository.RefreshTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Manages opaque, DB-backed, rotating refresh tokens (design decision D4 and
 * the JWT/Refresh Flow section). Only the SHA-256 hash is ever persisted.
 */
@Service
public class RefreshTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final long refreshTokenTtlDays;

    public RefreshTokenService(
            RefreshTokenRepository refreshTokenRepository,
            @Value("${flowpilot.jwt.refresh-token-ttl-days}") long refreshTokenTtlDays) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshTokenTtlDays = refreshTokenTtlDays;
    }

    /** Issues a brand-new refresh token for a user (e.g. on login). */
    public String issue(User user) {
        String rawToken = generateRawToken();
        RefreshToken token = new RefreshToken(user, hash(rawToken), OffsetDateTime.now().plusDays(refreshTokenTtlDays));
        refreshTokenRepository.save(token);
        return rawToken;
    }

    /**
     * Validates the raw refresh token and rotates it: revokes the old row and
     * issues a new one. Reuse of an already-revoked token revokes ALL of that
     * user's active tokens (compromise response) before rejecting.
     */
    public RotationResult rotate(String rawToken) {
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new InvalidRefreshTokenException("Unknown refresh token"));

        if (stored.isRevoked()) {
            revokeAllActiveTokensFor(stored.getUser());
            throw new InvalidRefreshTokenException("Refresh token reuse detected");
        }

        if (stored.isExpired()) {
            throw new InvalidRefreshTokenException("Refresh token expired");
        }

        User user = stored.getUser();
        if (!user.isActive()) {
            throw new InvalidRefreshTokenException("User is deactivated");
        }

        stored.setRevokedAt(OffsetDateTime.now());
        refreshTokenRepository.save(stored);

        String newRawToken = issue(user);
        return new RotationResult(newRawToken, user);
    }

    /** Revokes the token presented at logout, if it exists. Idempotent. */
    public void revoke(String rawToken) {
        refreshTokenRepository.findByTokenHash(hash(rawToken)).ifPresent(token -> {
            token.setRevokedAt(OffsetDateTime.now());
            refreshTokenRepository.save(token);
        });
    }

    private void revokeAllActiveTokensFor(User user) {
        List<RefreshToken> active = refreshTokenRepository.findAllByUserAndRevokedAtIsNull(user);
        OffsetDateTime now = OffsetDateTime.now();
        active.forEach(token -> token.setRevokedAt(now));
        refreshTokenRepository.saveAll(active);
    }

    private String generateRawToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    public record RotationResult(String rawToken, User user) {
    }
}
