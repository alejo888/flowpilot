package com.flowpilot.service;

import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.entity.RefreshToken;
import com.flowpilot.entity.User;
import com.flowpilot.exception.InvalidCurrentPasswordException;
import com.flowpilot.exception.SamePasswordException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.RefreshTokenRepository;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.security.AuthRateLimiter;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * User directory (spec: user-directory) plus the authenticated caller's own
 * profile/password (spec: profile). Listing/lookup by id requires only that
 * the CALLER be authenticated and active — no special global role or project
 * permission on the target (interim rule, consistent with slices 3-6, until
 * slice 8's permission matrix exists), but a deactivated caller is rejected
 * the same way {@link #getProfile} already is, so a still-valid access token
 * from a just-deactivated account cannot keep browsing the directory.
 * {@code changePassword} mirrors {@link PasswordResetService#resetPassword}
 * — same "verify, re-hash, revoke all refresh tokens" shape, but
 * authenticated by the caller's own current password instead of a mailed
 * reset token. Unlike that unauthenticated flow, the caller here is still
 * legitimately logged in, so a fresh refresh token is issued for the current
 * session immediately after revoking the old ones — otherwise the browser
 * would keep presenting a now-revoked refresh cookie and the next automatic
 * {@code /api/auth/refresh} would hit rotation's reuse-detection branch.
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final RefreshTokenService refreshTokenService;
    private final PasswordEncoder passwordEncoder;
    private final AuthRateLimiter authRateLimiter;

    public UserService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            RefreshTokenService refreshTokenService,
            PasswordEncoder passwordEncoder,
            AuthRateLimiter authRateLimiter) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
        this.authRateLimiter = authRateLimiter;
    }

    public List<UserSummaryResponse> listUsers(Long callerId) {
        requireActive(callerId);
        return userRepository.findAll().stream()
                .map(UserService::toSummary)
                .toList();
    }

    public UserSummaryResponse findById(Long callerId, Long id) {
        requireActive(callerId);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        return toSummary(user);
    }

    public UserAdminResponse getProfile(Long id) {
        User user = requireActive(id);
        return toAdminResponse(user);
    }

    /**
     * Verifies {@code currentPassword}, rejects a same-as-current
     * {@code newPassword} (a no-op "change" that would still revoke every
     * session for nothing), re-hashes, revokes all of the caller's active
     * refresh tokens, then issues a fresh one for this session. Returns the
     * new raw refresh token so the controller can set it as the response
     * cookie, exactly like login/refresh do.
     *
     * <p>{@code currentPassword} verification is rate-limited per caller
     * (keyed by user id, not IP): this is an authenticated endpoint acting on
     * the caller's own account, so a holder of a stolen/borrowed access token
     * would otherwise get unlimited guesses against the real password.
     */
    @Transactional
    public String changePassword(Long id, String currentPassword, String newPassword) {
        User user = requireActive(id);

        authRateLimiter.ensureUserWithinLimit(AuthRateLimiter.CHANGE_PASSWORD, id);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            authRateLimiter.countUserAttemptOrReject(AuthRateLimiter.CHANGE_PASSWORD, id);
            throw new InvalidCurrentPasswordException("La contraseña actual no es correcta");
        }
        authRateLimiter.resetUser(AuthRateLimiter.CHANGE_PASSWORD, id);

        if (newPassword.equals(currentPassword)) {
            throw new SamePasswordException("La nueva contraseña debe ser diferente a la actual");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));

        List<RefreshToken> active = refreshTokenRepository.findAllByUserAndRevokedAtIsNull(user);
        OffsetDateTime now = OffsetDateTime.now();
        active.forEach(t -> t.setRevokedAt(now));
        refreshTokenRepository.saveAll(active);

        return refreshTokenService.issue(user);
    }

    /**
     * Loads the caller and rejects a deactivated account, matching the
     * activeness guard already applied by {@link AdminUserService},
     * {@link ProjectService} and {@link ProjectAuthorizationService}: access
     * tokens are stateless and stay valid for their full lifetime regardless
     * of DB state, so without this a just-deactivated user could still read
     * their profile and — far worse — permanently rewrite their password hash
     * through {@code PUT /api/users/me/password}. That mutation would survive
     * the token's expiry and any later reactivation. Reads are rejected too,
     * mirroring {@link ProjectAuthorizationService#canView}, which denies a
     * deactivated caller on every branch.
     */
    private User requireActive(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        if (!user.isActive()) {
            throw new AccessDeniedException("La cuenta está desactivada");
        }
        return user;
    }

    private static UserSummaryResponse toSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getName(), user.getEmail());
    }

    private static UserAdminResponse toAdminResponse(User user) {
        return new UserAdminResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.isActive());
    }
}
