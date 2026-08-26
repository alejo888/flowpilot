package com.flowpilot.controller;

import com.flowpilot.dto.ChangePasswordRequest;
import com.flowpilot.dto.UserAdminResponse;
import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.security.CookieService;
import com.flowpilot.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only user directory (spec: user-directory) plus the authenticated
 * caller's own profile and password (spec: profile). Requires authentication
 * only — no special global role or project permission on the TARGET at this
 * stage (interim rule, consistent with slices 3-6, until slice 8's
 * permission matrix exists). Authentication itself is enforced globally by
 * {@link com.flowpilot.security.SecurityConfig}'s {@code anyRequest().authenticated()};
 * {@link UserService} additionally rejects a deactivated CALLER on every
 * method here, consistent with {@code /me} and {@code /me/password}.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final CookieService cookieService;

    public UserController(UserService userService, CookieService cookieService) {
        this.userService = userService;
        this.cookieService = cookieService;
    }

    @Operation(summary = "List users (read-only directory, for member selection)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Users"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller's account is deactivated",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping
    public List<UserSummaryResponse> listUsers(Authentication authentication) {
        return userService.listUsers(currentUserId(authentication));
    }

    @Operation(summary = "Get a single user by id")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "User found"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller's account is deactivated",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No user with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/{id}")
    public UserSummaryResponse getUser(@PathVariable Long id, Authentication authentication) {
        return userService.findById(currentUserId(authentication), id);
    }

    @Operation(summary = "Get the authenticated caller's own profile")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Caller's profile"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller's account is deactivated",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/me")
    public UserAdminResponse getCurrentUser(Authentication authentication) {
        return userService.getProfile(currentUserId(authentication));
    }

    @Operation(summary = "Change the authenticated caller's own password")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                description = "Password updated; all of the caller's refresh tokens revoked and a fresh one "
                        + "issued and set as the refreshToken cookie for the current session, exactly like "
                        + "login/refresh do."),
        @ApiResponse(responseCode = "400", description = "Validation failed, current password is incorrect, "
                + "or newPassword equals currentPassword",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Caller's account is deactivated",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "429", description = "Too many incorrect currentPassword attempts",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest request, Authentication authentication) {
        String rawRefreshToken = userService.changePassword(
                currentUserId(authentication), request.currentPassword(), request.newPassword());
        ResponseCookie cookie = cookieService.buildRefreshCookie(rawRefreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .build();
    }

    private Long currentUserId(Authentication authentication) {
        return Long.parseLong(authentication.getName());
    }
}
