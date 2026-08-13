package com.flowpilot.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Stateless security config per design decision D3.
 *
 * {@code /api/auth/**} is public (registration/login/refresh/logout/reset all
 * start unauthenticated); everything else requires a valid Bearer JWT.
 * {@code /v3/api-docs/**} (springdoc's live-generated OpenAPI document) is
 * also public — it carries no sensitive data and must stay reachable by the
 * CI drift check ({@code OpenApiSpecExportTest}) without a bearer token.
 * {@link JwtAuthenticationFilter} runs before
 * {@code UsernamePasswordAuthenticationFilter} and never hits the DB (see its
 * javadoc for the accepted deactivated-user tradeoff).
 *
 * Spring Security's built-in CSRF protection stays disabled for the whole
 * API: state-changing Bearer-authenticated endpoints are not vulnerable to
 * CSRF (a cross-site page cannot read the bearer token to forge it). The two
 * cookie-authenticated endpoints (refresh/logout) instead get a custom
 * double-submit check via {@link CsrfProtectionFilter} per design decision D8.
 *
 * An explicit {@link HttpStatusEntryPoint} maps unauthenticated access to a
 * protected resource to {@code 401} — Spring Security's framework default
 * (no entry point configured) is {@code 403 Forbidden}, which does not match
 * the API-wide contract (e.g. spec: user-directory, "Unauthenticated access"
 * scenario expects {@code 401}).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            CsrfProtectionFilter csrfProtectionFilter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptionHandling -> exceptionHandling
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/v3/api-docs/**").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(csrfProtectionFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter(JwtService jwtService) {
        return new JwtAuthenticationFilter(jwtService);
    }

    @Bean
    public CsrfProtectionFilter csrfProtectionFilter() {
        return new CsrfProtectionFilter();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
