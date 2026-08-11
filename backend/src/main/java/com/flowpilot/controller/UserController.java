package com.flowpilot.controller;

import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.service.UserService;
import java.util.List;
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

    @GetMapping
    public List<UserSummaryResponse> listUsers() {
        return userService.listUsers();
    }

    @GetMapping("/{id}")
    public UserSummaryResponse getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
