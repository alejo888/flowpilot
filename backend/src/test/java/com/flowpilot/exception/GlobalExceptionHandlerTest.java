package com.flowpilot.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void duplicateEmailMapsTo409() {
        ProblemDetail detail = handler.handleDuplicateEmail(new DuplicateEmailException("dup@flowpilot.local"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(detail.getDetail()).contains("dup@flowpilot.local");
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
        assertThat(detail.getDetail()).isEqualTo("Invalid email or password");
    }

    @Test
    void disabledAccountMapsTo401WithDeactivatedDetail() {
        ProblemDetail detail = handler.handleDisabled(new DisabledException("disabled"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(detail.getDetail()).isEqualTo("Account is deactivated");
    }
}
