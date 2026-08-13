package com.flowpilot.controller;

import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.List;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only user directory (spec: user-directory). Requires authentication
 * only — no special global role or project permission at this stage (interim
 * rule, consistent with slices 3-6, until slice 8's permission matrix
 * exists). Authentication itself is enforced globally by
 * {@link com.flowpilot.security.SecurityConfig}'s {@code anyRequest().authenticated()}.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "List users (read-only directory, for member selection)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Users"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping
    public List<UserSummaryResponse> listUsers() {
        return userService.listUsers();
    }

    @Operation(summary = "Get a single user by id")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "User found"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid access token",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No user with that id",
                content = @Content(mediaType = "application/problem+json",
                        schema = @Schema(implementation = ProblemDetail.class)))
    })
    @GetMapping("/{id}")
    public UserSummaryResponse getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
