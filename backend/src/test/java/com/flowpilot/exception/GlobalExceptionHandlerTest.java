package com.flowpilot.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

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

    @Test
    void unreadableBodyMapsTo400NotTo500() {
        ProblemDetail detail = handler.handleNotReadable(
                new HttpMessageNotReadableException("JSON parse error", emptyInputMessage()));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(detail.getDetail()).isEqualTo("El cuerpo de la petición es inválido o ilegible");
    }

    @Test
    void unsupportedMediaTypeMapsTo415NotTo500() {
        ProblemDetail detail = handler.handleMediaTypeNotSupported(
                new HttpMediaTypeNotSupportedException(MediaType.TEXT_PLAIN, List.of(MediaType.APPLICATION_JSON)));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE.value());
        assertThat(detail.getDetail()).isEqualTo("El tipo de contenido de la petición no está soportado");
    }

    @Test
    void unsupportedMethodMapsTo405NotTo500() {
        ProblemDetail detail = handler.handleMethodNotSupported(
                new HttpRequestMethodNotSupportedException("DELETE", List.of("GET", "POST")));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED.value());
        assertThat(detail.getDetail()).isEqualTo("El método HTTP no está permitido para este recurso");
    }

    @Test
    void unknownRouteMapsTo404NotTo500() {
        ProblemDetail detail = handler.handleNoResourceFound(
                new NoResourceFoundException(HttpMethod.GET, "", "/api/does-not-exist"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(detail.getDetail()).isEqualTo("El recurso solicitado no existe");
    }

    private static HttpInputMessage emptyInputMessage() {
        return new HttpInputMessage() {
            @Override
            public java.io.InputStream getBody() {
                return java.io.InputStream.nullInputStream();
            }

            @Override
            public org.springframework.http.HttpHeaders getHeaders() {
                return new org.springframework.http.HttpHeaders();
            }
        };
    }

    @Test
    void aiGenerationFailureMapsTo503WithSpanishDetail() {
        ProblemDetail detail = handler.handleAiGeneration(
                new AiGenerationException("ollama connection refused: 127.0.0.1:11434"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE.value());
        assertThat(detail.getDetail()).isEqualTo("El asistente de IA no está disponible en este momento.");
        assertThat(detail.getDetail()).doesNotContain("11434");
    }

    @Test
    void trulyUnexpectedErrorStillMapsTo500() {
        ProblemDetail detail = handler.handleUnexpected(new IllegalStateException("boom"));

        assertThat(detail.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
        assertThat(detail.getDetail()).isEqualTo("Ocurrió un error inesperado");
    }
}
