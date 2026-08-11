package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.RefreshToken;
import com.flowpilot.entity.User;
import com.flowpilot.exception.InvalidRefreshTokenException;
import com.flowpilot.repository.RefreshTokenRepository;
import java.lang.reflect.Field;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private RefreshTokenService refreshTokenService;

    @BeforeEach
    void setUp() {
        refreshTokenService = new RefreshTokenService(refreshTokenRepository, 7);
    }

    @Test
    void issueCreatesTokenLinkedToUser() {
        User user = activeUser(1L);
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        String rawToken = refreshTokenService.issue(user);

        assertThat(rawToken).isNotBlank();
        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isEqualTo(user);
        assertThat(captor.getValue().isRevoked()).isFalse();
    }

    @Test
    void rotateWithValidTokenRevokesOldAndIssuesNew() {
        User user = activeUser(2L);
        RefreshToken stored = new RefreshToken(user, "irrelevant-hash", OffsetDateTime.now().plusDays(1));
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        RefreshTokenService.RotationResult result = refreshTokenService.rotate("raw-valid-token");

        assertThat(result.rawToken()).isNotBlank();
        assertThat(result.user()).isEqualTo(user);
        assertThat(stored.isRevoked()).isTrue();
        verify(refreshTokenRepository, times(2)).save(any(RefreshToken.class));
    }

    @Test
    void rotateWithUnknownTokenThrows() {
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> refreshTokenService.rotate("unknown-token"))
                .isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void rotateWithExpiredTokenThrows() {
        User user = activeUser(3L);
        RefreshToken stored = new RefreshToken(user, "hash", OffsetDateTime.now().minusMinutes(1));
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> refreshTokenService.rotate("expired-token"))
                .isInstanceOf(InvalidRefreshTokenException.class);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void rotateWithRevokedTokenIsTreatedAsReuseAndRevokesAllUserTokens() {
        User user = activeUser(4L);
        RefreshToken stored = new RefreshToken(user, "hash", OffsetDateTime.now().plusDays(1));
        stored.setRevokedAt(OffsetDateTime.now().minusMinutes(5));
        RefreshToken otherActive = new RefreshToken(user, "other-hash", OffsetDateTime.now().plusDays(1));
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));
        when(refreshTokenRepository.findAllByUserAndRevokedAtIsNull(user)).thenReturn(List.of(otherActive));

        assertThatThrownBy(() -> refreshTokenService.rotate("reused-token"))
                .isInstanceOf(InvalidRefreshTokenException.class);

        assertThat(otherActive.isRevoked()).isTrue();
        verify(refreshTokenRepository).saveAll(List.of(otherActive));
    }

    @Test
    void rotateWithDeactivatedUserThrows() {
        User user = activeUser(5L);
        RefreshToken stored = new RefreshToken(user, "hash", OffsetDateTime.now().plusDays(1));
        user.setActive(false);
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> refreshTokenService.rotate("inactive-user-token"))
                .isInstanceOf(InvalidRefreshTokenException.class);
    }

    private User activeUser(Long id) {
        User user = new User("Name " + id, "user" + id + "@flowpilot.local", "hash", GlobalRole.MIEMBRO_EQUIPO, true);
        try {
            Field field = User.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        return user;
    }
}
