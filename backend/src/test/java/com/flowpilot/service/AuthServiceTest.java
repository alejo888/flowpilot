package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.RegisterRequest;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import com.flowpilot.exception.DuplicateEmailException;
import com.flowpilot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder);
    }

    @Test
    void registerCreatesActiveTeamMemberWithHashedPassword() {
        RegisterRequest request = new RegisterRequest("Ada Lovelace", "ada@flowpilot.local", "supersecret1");
        when(userRepository.existsByEmail("ada@flowpilot.local")).thenReturn(false);
        when(passwordEncoder.encode("supersecret1")).thenReturn("hashed-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User created = authService.register(request);

        assertThat(created.getEmail()).isEqualTo("ada@flowpilot.local");
        assertThat(created.getName()).isEqualTo("Ada Lovelace");
        assertThat(created.getPasswordHash()).isEqualTo("hashed-password");
        assertThat(created.getRole()).isEqualTo(GlobalRole.MIEMBRO_EQUIPO);
        assertThat(created.isActive()).isTrue();

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("ada@flowpilot.local");
    }

    @Test
    void registerWithDuplicateEmailThrowsAndDoesNotSave() {
        RegisterRequest request = new RegisterRequest("Grace Hopper", "grace@flowpilot.local", "supersecret1");
        when(userRepository.existsByEmail("grace@flowpilot.local")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(DuplicateEmailException.class);

        verify(userRepository, org.mockito.Mockito.never()).save(any());
    }
}
