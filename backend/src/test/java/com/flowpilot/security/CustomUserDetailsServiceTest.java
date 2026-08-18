package com.flowpilot.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import com.flowpilot.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@ExtendWith(MockitoExtension.class)
class CustomUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;

    @Test
    void loadUserByUsernameReturnsEnabledDetailsForActiveUser() {
        User user = new User("Ada Lovelace", "ada@flowpilot.local", "hashed", GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findByEmail("ada@flowpilot.local")).thenReturn(Optional.of(user));

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);
        UserDetails details = service.loadUserByUsername("ada@flowpilot.local");

        assertThat(details.getUsername()).isEqualTo("ada@flowpilot.local");
        assertThat(details.getPassword()).isEqualTo("hashed");
        assertThat(details.isEnabled()).isTrue();
    }

    @Test
    void loadUserByUsernameReturnsDisabledDetailsForDeactivatedUser() {
        User user = new User("Ada Lovelace", "ada@flowpilot.local", "hashed", GlobalRole.MIEMBRO_EQUIPO, false);
        when(userRepository.findByEmail("ada@flowpilot.local")).thenReturn(Optional.of(user));

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);
        UserDetails details = service.loadUserByUsername("ada@flowpilot.local");

        assertThat(details.isEnabled()).isFalse();
    }

    @Test
    void loadUserByUsernameNormalizesEmailCaseSoAnyCasingLogsIn() {
        User user = new User("Ada Lovelace", "ada@x.com", "hashed", GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findByEmail("ada@x.com")).thenReturn(Optional.of(user));

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);
        UserDetails details = service.loadUserByUsername("Ada@X.com");

        assertThat(details.getUsername()).isEqualTo("ada@x.com");
    }

    @Test
    void loadUserByUsernameThrowsWhenUnknown() {
        when(userRepository.findByEmail("missing@flowpilot.local")).thenReturn(Optional.empty());

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);

        assertThatThrownBy(() -> service.loadUserByUsername("missing@flowpilot.local"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
