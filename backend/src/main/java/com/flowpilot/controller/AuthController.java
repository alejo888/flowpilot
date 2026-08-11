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
import com.flowpilot.service.PasswordResetService;
import com.flowpilot.service.RefreshTokenService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
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

    @PostMapping("/register")
    public ResponseEntity<Void> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PostMapping("/login")
    public ResponseEntity<AccessTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalStateException("Authenticated user vanished: " + request.email()));

        String accessToken = jwtService.generateAccessToken(user);
        String rawRefreshToken = refreshTokenService.issue(user);
        ResponseCookie cookie = cookieService.buildRefreshCookie(rawRefreshToken);
        ResponseCookie csrfCookie = cookieService.buildCsrfCookie(cookieService.generateCsrfToken());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString(), csrfCookie.toString())
                .body(new AccessTokenResponse(accessToken, jwtService.getAccessTokenTtlSeconds()));
    }

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

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.forgotPassword(request.email());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok().build();
    }
}
