package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.PasswordResetToken;
import com.flowpilot.entity.RefreshToken;
import com.flowpilot.entity.User;
import com.flowpilot.exception.InvalidResetTokenException;
import com.flowpilot.repository.PasswordResetTokenRepository;
import com.flowpilot.repository.RefreshTokenRepository;
import com.flowpilot.repository.UserRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    private PasswordResetService passwordResetService;

    @BeforeEach
    void setUp() {
        passwordResetService = new PasswordResetService(
                userRepository, passwordResetTokenRepository, refreshTokenRepository, passwordEncoder, 30);
    }

    @Test
    void forgotPasswordForExistingEmailCreatesToken() {
        User user = new User("Ada", "ada@flowpilot.local", "hash", GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findByEmail("ada@flowpilot.local")).thenReturn(Optional.of(user));

        passwordResetService.forgotPassword("ada@flowpilot.local");

        verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
    }

    @Test
    void forgotPasswordForUnknownEmailDoesNotCreateTokenButDoesNotThrow() {
        when(userRepository.findByEmail("nobody@flowpilot.local")).thenReturn(Optional.empty());

        passwordResetService.forgotPassword("nobody@flowpilot.local");

        verify(passwordResetTokenRepository, never()).save(any());
    }

    @Test
    void resetPasswordWithValidTokenUpdatesPasswordAndRevokesAllRefreshTokens() {
        User user = new User("Ada", "ada@flowpilot.local", "old-hash", GlobalRole.MIEMBRO_EQUIPO, true);
        PasswordResetToken token = new PasswordResetToken(user, "hashed-token", OffsetDateTime.now().plusMinutes(10));
        when(passwordResetTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(token));
        when(passwordEncoder.encode("newSecret1")).thenReturn("new-hash");
        RefreshToken active = new RefreshToken(user, "rt-hash", OffsetDateTime.now().plusDays(1));
        when(refreshTokenRepository.findAllByUserAndRevokedAtIsNull(user)).thenReturn(List.of(active));

        passwordResetService.resetPassword("raw-reset-token", "newSecret1");

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        assertThat(token.isUsed()).isTrue();
        assertThat(active.isRevoked()).isTrue();
        ArgumentCaptor<List<RefreshToken>> captor = ArgumentCaptor.forClass(List.class);
        verify(refreshTokenRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(active);
    }

    @Test
    void resetPasswordWithExpiredTokenThrows() {
        User user = new User("Ada", "ada@flowpilot.local", "old-hash", GlobalRole.MIEMBRO_EQUIPO, true);
        PasswordResetToken token = new PasswordResetToken(user, "hashed-token", OffsetDateTime.now().minusMinutes(1));
        when(passwordResetTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> passwordResetService.resetPassword("raw-reset-token", "newSecret1"))
                .isInstanceOf(InvalidResetTokenException.class);
    }

    @Test
    void resetPasswordWithUnknownTokenThrows() {
        when(passwordResetTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> passwordResetService.resetPassword("unknown", "newSecret1"))
                .isInstanceOf(InvalidResetTokenException.class);
    }

    @Test
    void resetPasswordWithAlreadyUsedTokenThrows() {
        User user = new User("Ada", "ada@flowpilot.local", "old-hash", GlobalRole.MIEMBRO_EQUIPO, true);
        PasswordResetToken token = new PasswordResetToken(user, "hashed-token", OffsetDateTime.now().plusMinutes(10));
        token.setUsedAt(OffsetDateTime.now().minusMinutes(1));
        when(passwordResetTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> passwordResetService.resetPassword("raw-reset-token", "newSecret1"))
                .isInstanceOf(InvalidResetTokenException.class);
    }
}
