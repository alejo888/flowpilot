package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.entity.GlobalRole;
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
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private PasswordEncoder passwordEncoder;

    private final AuthRateLimiter authRateLimiter = new AuthRateLimiter();

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(
                userRepository, refreshTokenRepository, refreshTokenService, passwordEncoder, authRateLimiter);
    }

    @Test
    void listUsersReturnsSummariesForActiveAndInactiveUsers() throws Exception {
        User caller = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        User inactive = user(2L, "Grace Hopper", "grace@flowpilot.local", false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(caller));
        when(userRepository.findAll()).thenReturn(List.of(caller, inactive));

        List<UserSummaryResponse> result = userService.listUsers(1L);

        assertThat(result).containsExactly(
                new UserSummaryResponse(1L, "Ada Lovelace", "ada@flowpilot.local"),
                new UserSummaryResponse(2L, "Grace Hopper", "grace@flowpilot.local"));
    }

    @Test
    void listUsersOmitsSensitiveFields() throws Exception {
        User caller = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(caller));
        when(userRepository.findAll()).thenReturn(List.of(caller));

        List<UserSummaryResponse> result = userService.listUsers(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).toString()).doesNotContain("hash").doesNotContain("passwordHash");
    }

    @Test
    void listUsersRejectsDeactivatedCaller() throws Exception {
        User deactivated = user(4L, "Grace Hopper", "grace@flowpilot.local", false);
        when(userRepository.findById(4L)).thenReturn(Optional.of(deactivated));

        assertThatThrownBy(() -> userService.listUsers(4L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("La cuenta está desactivada");

        org.mockito.Mockito.verify(userRepository, org.mockito.Mockito.never()).findAll();
    }

    @Test
    void findByIdReturnsSummaryWhenFound() throws Exception {
        User caller = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        User user = user(3L, "Katherine Johnson", "katherine@flowpilot.local", true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(caller));
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));

        UserSummaryResponse result = userService.findById(1L, 3L);

        assertThat(result).isEqualTo(new UserSummaryResponse(3L, "Katherine Johnson", "katherine@flowpilot.local"));
    }

    @Test
    void findByIdThrowsWhenNotFound() throws Exception {
        User caller = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(caller));
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findById(1L, 99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void findByIdRejectsDeactivatedCaller() throws Exception {
        User deactivated = user(4L, "Grace Hopper", "grace@flowpilot.local", false);
        when(userRepository.findById(4L)).thenReturn(Optional.of(deactivated));

        assertThatThrownBy(() -> userService.findById(4L, 3L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("La cuenta está desactivada");
    }

    @Test
    void getProfileReturnsAdminResponseWhenFound() throws Exception {
        User user = user(3L, "Katherine Johnson", "katherine@flowpilot.local", true);
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));

        UserAdminResponse result = userService.getProfile(3L);

        assertThat(result).isEqualTo(
                new UserAdminResponse(3L, "Katherine Johnson", "katherine@flowpilot.local", GlobalRole.MIEMBRO_EQUIPO, true));
    }

    @Test
    void getProfileThrowsWhenNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getProfile(99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void getProfileRejectsDeactivatedCaller() throws Exception {
        User deactivated = user(4L, "Grace Hopper", "grace@flowpilot.local", false);
        when(userRepository.findById(4L)).thenReturn(Optional.of(deactivated));

        assertThatThrownBy(() -> userService.getProfile(4L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("La cuenta está desactivada");
    }

    @Test
    void changePasswordRejectsDeactivatedCallerWithoutMutatingHashOrTokens() throws Exception {
        User deactivated = user(4L, "Grace Hopper", "grace@flowpilot.local", false);
        when(userRepository.findById(4L)).thenReturn(Optional.of(deactivated));

        assertThatThrownBy(() -> userService.changePassword(4L, "oldSecret1", "newSecret1"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("La cuenta está desactivada");

        assertThat(deactivated.getPasswordHash()).isEqualTo("hash");
        org.mockito.Mockito.verify(refreshTokenRepository, org.mockito.Mockito.never()).saveAll(any());
        org.mockito.Mockito.verifyNoInteractions(passwordEncoder);
    }

    @Test
    void changePasswordWithCorrectCurrentPasswordUpdatesHashRevokesRefreshTokensAndIssuesAFreshOne() throws Exception {
        User user = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("oldSecret1", "hash")).thenReturn(true);
        when(passwordEncoder.encode("newSecret1")).thenReturn("new-hash");
        RefreshToken active = new RefreshToken(user, "rt-hash", OffsetDateTime.now().plusDays(1));
        when(refreshTokenRepository.findAllByUserAndRevokedAtIsNull(user)).thenReturn(List.of(active));
        when(refreshTokenService.issue(user)).thenReturn("fresh-raw-token");

        String rawToken = userService.changePassword(1L, "oldSecret1", "newSecret1");

        assertThat(rawToken).isEqualTo("fresh-raw-token");
        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        assertThat(active.isRevoked()).isTrue();
        ArgumentCaptor<List<RefreshToken>> captor = ArgumentCaptor.forClass(List.class);
        org.mockito.Mockito.verify(refreshTokenRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(active);
        org.mockito.Mockito.verify(refreshTokenService).issue(user);
    }

    @Test
    void changePasswordWithWrongCurrentPasswordThrowsAndDoesNotMutate() throws Exception {
        User user = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongSecret", "hash")).thenReturn(false);

        assertThatThrownBy(() -> userService.changePassword(1L, "wrongSecret", "newSecret1"))
                .isInstanceOf(InvalidCurrentPasswordException.class);

        assertThat(user.getPasswordHash()).isEqualTo("hash");
        org.mockito.Mockito.verify(refreshTokenRepository, org.mockito.Mockito.never()).saveAll(any());
        org.mockito.Mockito.verifyNoInteractions(refreshTokenService);
    }

    @Test
    void changePasswordRejectsNewPasswordEqualToCurrentPasswordWithoutMutatingOrRevoking() throws Exception {
        User user = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("sameSecret1", "hash")).thenReturn(true);

        assertThatThrownBy(() -> userService.changePassword(1L, "sameSecret1", "sameSecret1"))
                .isInstanceOf(com.flowpilot.exception.SamePasswordException.class)
                .hasMessage("La nueva contraseña debe ser diferente a la actual");

        assertThat(user.getPasswordHash()).isEqualTo("hash");
        org.mockito.Mockito.verify(refreshTokenRepository, org.mockito.Mockito.never()).saveAll(any());
        org.mockito.Mockito.verifyNoInteractions(refreshTokenService);
    }

    @Test
    void changePasswordThrowsUserNotFoundWhenUserMissing() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.changePassword(99L, "whatever1", "newSecret1"))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void changePasswordRateLimitsRepeatedWrongCurrentPasswordAttemptsPerCaller() throws Exception {
        User user = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongSecret", "hash")).thenReturn(false);

        // AuthRateLimiter.MAX_ATTEMPTS_PER_USER (5) is package-private to
        // com.flowpilot.security; the exact count is asserted directly in
        // AuthRateLimiterTest, so this test only needs "eventually 429s".
        int maxAttemptsPerUser = 5;
        for (int attempt = 0; attempt < maxAttemptsPerUser; attempt++) {
            assertThatThrownBy(() -> userService.changePassword(1L, "wrongSecret", "newSecret1"))
                    .isInstanceOf(InvalidCurrentPasswordException.class);
        }

        assertThatThrownBy(() -> userService.changePassword(1L, "wrongSecret", "newSecret1"))
                .isInstanceOf(com.flowpilot.exception.TooManyRequestsException.class);
    }

    private User user(Long id, String name, String email, boolean active) throws Exception {
        User user = new User(name, email, "hash", GlobalRole.MIEMBRO_EQUIPO, active);
        var field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }
}
