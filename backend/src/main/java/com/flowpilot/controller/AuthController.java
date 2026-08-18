package com.flowpilot.controller;

import com.flowpilot.dto.AccessTokenResponse;
import com.flowpilot.dto.ForgotPasswordRequest;
import com.flowpilot.dto.LoginRequest;
import com.flowpilot.dto.RegisterRequest;
import com.flowpilot.dto.ResetPasswordRequest;
import com.flowpilot.entity.User;
import com.flowpilot.exception.InvalidRefreshTokenException;
import com.flowpilot.repository.UserRepository;
import com.flowpilot.security.CookieService;
import com.flowpilot.security.JwtService;
import com.flowpilot.service.AuthService;
import com.flowpilot.service.EmailNormalizer;
import com.flowpilot.service.PasswordResetService;
import com.flowpilot.service.RefreshTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final PasswordResetService passwordResetService;
    private final CookieService cookieService;

    public AuthController(
            AuthService authService,
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            JwtService jwtService,
            RefreshTokenService refreshTokenService,
            PasswordResetService passwordResetService,
            CookieService cookieService) {
        this.authService = authService;
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.passwordResetService = passwordResetService;
        this.cookieService = cookieService;
    }

    @Operation(summary = "Self-service registration")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "User created"),
        @ApiResponse(responseCode = "400", description = "Validation error",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Email already registered",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping("/register")
    public ResponseEntity<Void> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @Operation(summary = "Login and issue tokens")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "Access token issued; refresh cookie set along with a readable-by-JS "
                        + "XSRF-TOKEN cookie (double-submit CSRF pattern, design decision D8). "
                        + "The client must echo the XSRF-TOKEN cookie value back as the "
                        + "X-XSRF-TOKEN header on subsequent /auth/refresh and /auth/logout calls."),
        @ApiResponse(responseCode = "401", description = "Invalid credentials or deactivated account",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping("/login")
    public ResponseEntity<AccessTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        String email = EmailNormalizer.normalize(request.email());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("Authenticated user vanished: " + email));

        String accessToken = jwtService.generateAccessToken(user);
        String rawRefreshToken = refreshTokenService.issue(user);
        ResponseCookie cookie = cookieService.buildRefreshCookie(rawRefreshToken);
        ResponseCookie csrfCookie = cookieService.buildCsrfCookie(cookieService.generateCsrfToken());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString(), csrfCookie.toString())
                .body(new AccessTokenResponse(accessToken, jwtService.getAccessTokenTtlSeconds()));
    }

    @Operation(summary = "Rotate refresh token and issue a new access token")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "New access token issued; refresh cookie and XSRF-TOKEN cookie rotated"),
        @ApiResponse(
                responseCode = "401",
                description = "Missing, expired, revoked, reused, or inactive-user refresh token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Missing or mismatched X-XSRF-TOKEN header (CSRF check failed)")
    })
    @PostMapping("/refresh")
    public ResponseEntity<AccessTokenResponse> refresh(
            @CookieValue(name = CookieService.COOKIE_NAME, required = false) String refreshToken) {
        if (refreshToken == null) {
            throw new InvalidRefreshTokenException("Missing refresh token");
        }

        RefreshTokenService.RotationResult result = refreshTokenService.rotate(refreshToken);
        String accessToken = jwtService.generateAccessToken(result.user());
        ResponseCookie cookie = cookieService.buildRefreshCookie(result.rawToken());
        ResponseCookie csrfCookie = cookieService.buildCsrfCookie(cookieService.generateCsrfToken());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString(), csrfCookie.toString())
                .body(new AccessTokenResponse(accessToken, jwtService.getAccessTokenTtlSeconds()));
    }

    @Operation(summary = "Revoke the refresh token and clear the cookie")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Logged out; refreshToken and XSRF-TOKEN cookies cleared"),
        @ApiResponse(responseCode = "403", description = "Missing or mismatched X-XSRF-TOKEN header (CSRF check failed)")
    })
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = CookieService.COOKIE_NAME, required = false) String refreshToken) {
        if (refreshToken != null) {
            refreshTokenService.revoke(refreshToken);
        }

        ResponseCookie clearCookie = cookieService.buildClearCookie();
        ResponseCookie clearCsrfCookie = cookieService.buildClearCsrfCookie();
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clearCookie.toString(), clearCsrfCookie.toString())
                .build();
    }

    @Operation(summary = "Request a password reset (always 200, no account enumeration)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Always returned, regardless of whether the account exists")
    })
    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.forgotPassword(request.email());
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Reset password using a valid reset token")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Password updated; all refresh tokens revoked"),
        @ApiResponse(responseCode = "400", description = "Unknown, expired, or already-used reset token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok().build();
    }
}
