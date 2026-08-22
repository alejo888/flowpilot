package com.flowpilot.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void duplicateEmailMapsTo409() {
        ProblemDetail detail = handler.handleDuplicateEmail(new DuplicateEmailException());

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(detail.getDetail()).isEqualTo("El email ya está registrado");
        assertThat(detail.getDetail()).doesNotContain("@");
    }

    @Test
    void invalidRefreshTokenMapsTo401() {
        ProblemDetail detail = handler.handleInvalidRefreshToken(new InvalidRefreshTokenException("expired"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(detail.getDetail()).isEqualTo("expired");
    }

    @Test
    void invalidResetTokenMapsTo400() {
        ProblemDetail detail = handler.handleInvalidResetToken(new InvalidResetTokenException("used"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
    }

    @Test
    void badCredentialsMapsTo401WithGenericDetail() {
        ProblemDetail detail = handler.handleBadCredentials(new BadCredentialsException("bad"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(detail.getDetail()).isEqualTo("Email o contraseña inválidos");
    }

    @Test
    void disabledAccountMapsTo401WithGenericDetail() {
        // Uses the same generic detail as bad credentials to avoid an account-state
        // enumeration signal on the login endpoint.
        ProblemDetail detail = handler.handleDisabled(new DisabledException("disabled"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(detail.getDetail()).isEqualTo("Email o contraseña inválidos");
    }

    @Test
    void userNotFoundMapsTo404() {
        ProblemDetail detail = handler.handleUserNotFound(new UserNotFoundException(42L));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(detail.getDetail()).contains("42");
    }

    @Test
    void projectNotFoundMapsTo404() {
        ProblemDetail detail = handler.handleProjectNotFound(new ProjectNotFoundException(7L));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(detail.getDetail()).contains("7");
    }

    @Test
    void accessDeniedMapsTo403() {
        ProblemDetail detail = handler.handleAccessDenied(new AccessDeniedException("Not the owner"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(detail.getDetail()).isEqualTo("Not the owner");
    }

    @Test
    void projectMemberNotFoundMapsTo404() {
        ProblemDetail detail = handler.handleProjectMemberNotFound(new ProjectMemberNotFoundException(7L, 42L));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(detail.getDetail()).contains("7").contains("42");
    }

    @Test
    void duplicateMemberMapsTo409() {
        ProblemDetail detail = handler.handleDuplicateMember(new DuplicateMemberException(7L, 42L));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(detail.getDetail()).contains("7").contains("42");
    }

    @Test
    void lastAdministratorMapsTo409() {
        ProblemDetail detail = handler.handleLastAdministrator(new LastAdministratorException());

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(detail.getDetail()).contains("administrador");
    }

    @Test
    void duplicateProjectCodeMapsTo409() {
        ProblemDetail detail = handler.handleDuplicateProjectCode(new DuplicateProjectCodeException("ABC"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(detail.getDetail()).contains("ABC");
    }

    @Test
    void invalidProjectDatesMapsTo400() {
        ProblemDetail detail = handler.handleInvalidProjectDates(new InvalidProjectDatesException());

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(detail.getDetail()).contains("fecha de inicio");
    }

    @Test
    void dataIntegrityViolationMapsTo409() {
        ProblemDetail detail = handler.handleDataIntegrityViolation(
                new DataIntegrityViolationException("duplicate key value violates unique constraint"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
    }
}
