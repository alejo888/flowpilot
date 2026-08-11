package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import com.flowpilot.exception.LastAdministratorException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.UserRepository;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    @Mock
    private UserRepository userRepository;

    private AdminUserService adminUserService;

    @BeforeEach
    void setUp() {
        adminUserService = new AdminUserService(userRepository);
    }

    @Test
    void listUsersRequiresAdminCaller() throws Exception {
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> adminUserService.listUsers(2L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void listUsersReturnsAllUsersForAdminCaller() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findAll()).thenReturn(List.of(admin, member));

        List<UserAdminResponse> result = adminUserService.listUsers(1L);

        assertThat(result).extracting(UserAdminResponse::id).containsExactly(1L, 2L);
        assertThat(result).extracting(UserAdminResponse::active).containsExactly(true, true);
    }

    @Test
    void setStatusDeactivatesUserWhenNotTheLastActiveAdmin() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        User target = user(2L, GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findById(2L)).thenReturn(Optional.of(target));
        when(userRepository.save(target)).thenReturn(target);

        UserAdminResponse response = adminUserService.setStatus(1L, 2L, false);

        assertThat(response.active()).isFalse();
        verify(userRepository, never()).findActiveAdministradoresForUpdate();
    }

    @Test
    void setStatusRejectsDeactivatingTheLastActiveAdministrador() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findActiveAdministradoresForUpdate()).thenReturn(List.of(admin));

        assertThatThrownBy(() -> adminUserService.setStatus(1L, 1L, false))
                .isInstanceOf(LastAdministratorException.class);

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void setStatusAllowsDeactivatingAnAdminWhenAnotherActiveAdminRemains() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        User otherAdmin = user(3L, GlobalRole.ADMINISTRADOR, true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findById(3L)).thenReturn(Optional.of(otherAdmin));
        when(userRepository.findActiveAdministradoresForUpdate()).thenReturn(List.of(admin, otherAdmin));
        when(userRepository.save(otherAdmin)).thenReturn(otherAdmin);

        UserAdminResponse response = adminUserService.setStatus(1L, 3L, false);

        assertThat(response.active()).isFalse();
    }

    @Test
    void setStatusReactivatingDoesNotRunTheLastAdminGuard() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        User target = user(2L, GlobalRole.MIEMBRO_EQUIPO, false);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findById(2L)).thenReturn(Optional.of(target));
        when(userRepository.save(target)).thenReturn(target);

        UserAdminResponse response = adminUserService.setStatus(1L, 2L, true);

        assertThat(response.active()).isTrue();
        verify(userRepository, never()).findActiveAdministradoresForUpdate();
    }

    @Test
    void changeRoleUpdatesGlobalRole() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        User target = user(2L, GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findById(2L)).thenReturn(Optional.of(target));
        when(userRepository.save(target)).thenReturn(target);

        UserAdminResponse response = adminUserService.changeRole(1L, 2L, GlobalRole.ADMINISTRADOR);

        assertThat(response.role()).isEqualTo(GlobalRole.ADMINISTRADOR);
    }

    @Test
    void changeRoleRejectsDemotingTheLastActiveAdministrador() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findActiveAdministradoresForUpdate()).thenReturn(List.of(admin));

        assertThatThrownBy(() -> adminUserService.changeRole(1L, 1L, GlobalRole.MIEMBRO_EQUIPO))
                .isInstanceOf(LastAdministratorException.class);

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void changeRoleAllowsSelfDemotionWhenAnotherActiveAdminRemains() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        User otherAdmin = user(3L, GlobalRole.ADMINISTRADOR, true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findActiveAdministradoresForUpdate()).thenReturn(List.of(admin, otherAdmin));
        when(userRepository.save(admin)).thenReturn(admin);

        UserAdminResponse response = adminUserService.changeRole(1L, 1L, GlobalRole.MIEMBRO_EQUIPO);

        assertThat(response.role()).isEqualTo(GlobalRole.MIEMBRO_EQUIPO);
    }

    @Test
    void setStatusThrows404WhenTargetUserMissing() throws Exception {
        User admin = user(1L, GlobalRole.ADMINISTRADOR, true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.setStatus(1L, 99L, false))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void setStatusRequiresAdminCaller() throws Exception {
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> adminUserService.setStatus(2L, 5L, false))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void changeRoleRequiresAdminCaller() throws Exception {
        User member = user(2L, GlobalRole.MIEMBRO_EQUIPO, true);
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> adminUserService.changeRole(2L, 5L, GlobalRole.ADMINISTRADOR))
                .isInstanceOf(AccessDeniedException.class);
    }

    private User user(Long id, GlobalRole role, boolean active) throws Exception {
        User user = new User("Name" + id, "user" + id + "@flowpilot.local", "hash", role, active);
        Field field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }
}
