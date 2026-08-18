package com.flowpilot.service;

import com.flowpilot.entity.PasswordResetToken;
import com.flowpilot.entity.RefreshToken;
import com.flowpilot.entity.User;
import com.flowpilot.exception.InvalidResetTokenException;
import com.flowpilot.repository.PasswordResetTokenRepository;
import com.flowpilot.repository.RefreshTokenRepository;
import com.flowpilot.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Forgot/reset password flow (design step 6). {@code forgotPassword} never
 * reveals whether an account exists — it always completes without throwing.
 */
@Service
public class PasswordResetService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final long resetTokenTtlMinutes;

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            @Value("${flowpilot.password-reset.ttl-minutes:30}") long resetTokenTtlMinutes) {
        this.userRepository = userRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.resetTokenTtlMinutes = resetTokenTtlMinutes;
    }

    /** Always completes successfully; only creates a token if the account exists (no enumeration). */
    public void forgotPassword(String email) {
        userRepository.findByEmail(EmailNormalizer.normalize(email)).ifPresent(user -> {
            String rawToken = generateRawToken();
            PasswordResetToken token = new PasswordResetToken(
                    user, hash(rawToken), OffsetDateTime.now().plusMinutes(resetTokenTtlMinutes));
            passwordResetTokenRepository.save(token);
            // MVP: real delivery is a console-logging MailSender (design step 6); nothing more to do here.
        });
    }

    /** Consumes the token, sets the new password, and revokes all of the user's refresh tokens. */
    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = passwordResetTokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new InvalidResetTokenException("El enlace de restablecimiento no es válido"));

        if (token.isUsed()) {
            throw new InvalidResetTokenException("El enlace de restablecimiento ya fue utilizado");
        }
        if (token.isExpired()) {
            throw new InvalidResetTokenException("El enlace de restablecimiento venció");
        }

        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        token.setUsedAt(OffsetDateTime.now());
        passwordResetTokenRepository.save(token);

        List<RefreshToken> active = refreshTokenRepository.findAllByUserAndRevokedAtIsNull(user);
        OffsetDateTime now = OffsetDateTime.now();
        active.forEach(t -> t.setRevokedAt(now));
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
}
