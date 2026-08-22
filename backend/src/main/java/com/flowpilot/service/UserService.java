package com.flowpilot.service;

import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.entity.RefreshToken;
import com.flowpilot.entity.User;
import com.flowpilot.exception.InvalidCurrentPasswordException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.RefreshTokenRepository;
import com.flowpilot.repository.UserRepository;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * User directory (spec: user-directory) plus the authenticated caller's own
 * profile/password (spec: profile). Listing/lookup by id is read-only and
 * open to any authenticated user — no role/permission restriction at this
 * stage (interim rule, consistent with slices 3-6, until slice 8's
 * permission matrix exists). {@code changePassword} mirrors {@link
 * PasswordResetService#resetPassword} — same "verify, re-hash, revoke all
 * refresh tokens" shape, but authenticated by the caller's own current
 * password instead of a mailed reset token.
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UserSummaryResponse> listUsers() {
        return userRepository.findAll().stream()
                .map(UserService::toSummary)
                .toList();
    }

    public UserSummaryResponse findById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        return toSummary(user);
    }

    public UserAdminResponse getProfile(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        return toAdminResponse(user);
    }

    /** Verifies {@code currentPassword}, re-hashes to {@code newPassword}, and revokes all active refresh tokens. */
    @Transactional
    public void changePassword(Long id, String currentPassword, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new InvalidCurrentPasswordException("La contraseña actual no es correcta");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));

        List<RefreshToken> active = refreshTokenRepository.findAllByUserAndRevokedAtIsNull(user);
        OffsetDateTime now = OffsetDateTime.now();
        active.forEach(t -> t.setRevokedAt(now));
        refreshTokenRepository.saveAll(active);
    }

    private static UserSummaryResponse toSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getName(), user.getEmail());
    }

    private static UserAdminResponse toAdminResponse(User user) {
        return new UserAdminResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.isActive());
    }
}
