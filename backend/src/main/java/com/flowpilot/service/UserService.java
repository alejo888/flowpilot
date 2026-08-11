package com.flowpilot.service;

import com.flowpilot.dto.UserSummaryResponse;
import com.flowpilot.entity.User;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Read-only user directory (spec: user-directory). Any authenticated user
 * may list members for the purpose of picking project members — no
 * role/permission restriction at this stage (interim rule, consistent with
 * slices 3-6, until slice 8's permission matrix exists).
 */
@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<UserSummaryResponse> listUsers() {
        return userRepository.findAll().stream()
                .map(UserService::toSummary)
                .toList();
    }

    public UserSummaryResponse findById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        return toSummary(user);
    }

    private static UserSummaryResponse toSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getName(), user.getEmail());
    }
}
