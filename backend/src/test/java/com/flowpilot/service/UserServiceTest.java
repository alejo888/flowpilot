package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository);
    }

    @Test
    void listUsersReturnsSummariesForActiveAndInactiveUsers() throws Exception {
        User active = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        User inactive = user(2L, "Grace Hopper", "grace@flowpilot.local", false);
        when(userRepository.findAll()).thenReturn(List.of(active, inactive));

        List<UserSummaryResponse> result = userService.listUsers();

        assertThat(result).containsExactly(
                new UserSummaryResponse(1L, "Ada Lovelace", "ada@flowpilot.local"),
                new UserSummaryResponse(2L, "Grace Hopper", "grace@flowpilot.local"));
    }

    @Test
    void listUsersOmitsSensitiveFields() throws Exception {
        User user = user(1L, "Ada Lovelace", "ada@flowpilot.local", true);
        when(userRepository.findAll()).thenReturn(List.of(user));

        List<UserSummaryResponse> result = userService.listUsers();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).toString()).doesNotContain("hash").doesNotContain("passwordHash");
    }

    @Test
    void findByIdReturnsSummaryWhenFound() throws Exception {
        User user = user(3L, "Katherine Johnson", "katherine@flowpilot.local", true);
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));

        UserSummaryResponse result = userService.findById(3L);

        assertThat(result).isEqualTo(new UserSummaryResponse(3L, "Katherine Johnson", "katherine@flowpilot.local"));
    }

    @Test
    void findByIdThrowsWhenNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findById(99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    private User user(Long id, String name, String email, boolean active) throws Exception {
        User user = new User(name, email, "hash", GlobalRole.MIEMBRO_EQUIPO, active);
        var field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }
}
