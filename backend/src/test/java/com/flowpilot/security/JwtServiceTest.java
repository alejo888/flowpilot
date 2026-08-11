package com.flowpilot.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "unit-test-secret-key-unit-test-secret-key-32b";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 15);
    }

    @Test
    void generateAccessTokenEncodesUserClaims() {
        User user = new User("Ada Lovelace", "ada@flowpilot.local", "hash", GlobalRole.MIEMBRO_EQUIPO, true);
        setId(user, 42L);

        String token = jwtService.generateAccessToken(user);

        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();

        assertThat(claims.getSubject()).isEqualTo("42");
        assertThat(claims.get("email", String.class)).isEqualTo("ada@flowpilot.local");
        assertThat(claims.get("role", String.class)).isEqualTo("MIEMBRO_EQUIPO");
    }

    @Test
    void accessTokenTtlSecondsMatchesConfiguredMinutes() {
        assertThat(jwtService.getAccessTokenTtlSeconds()).isEqualTo(15 * 60);
    }

    private void setId(User user, Long id) {
        try {
            var field = User.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }
}
