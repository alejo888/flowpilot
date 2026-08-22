package com.flowpilot.service;

import com.flowpilot.dto.RegisterRequest;
import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import com.flowpilot.exception.DuplicateEmailException;
import com.flowpilot.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Self-service registration. Creates a User with the default global role
     * "Miembro del equipo" and {@code active=true}. Never auto-logs the user in.
     * The email is normalized (trimmed + lower-cased) before the uniqueness check
     * and before persisting, so casing can never split one person into two
     * accounts.
     */
    public User register(RegisterRequest request) {
        String email = EmailNormalizer.normalize(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateEmailException();
        }

        String hashedPassword = passwordEncoder.encode(request.password());
        User user = new User(request.name(), email, hashedPassword, GlobalRole.MIEMBRO_EQUIPO, true);
        return userRepository.save(user);
    }
}
