package com.flowpilot.service;

/**
 * Single normalization rule for email lookups and persistence: trim surrounding
 * whitespace and lower-case the address. Emails are case-insensitive in
 * practice, so {@code Ada@X.com} and {@code ada@x.com} must resolve to the same
 * account. Normalization happens at the repository call sites (registration,
 * login lookup, forgot-password lookup) rather than in the DTOs, so the request
 * payload the client sent stays untouched. No DB-level change (e.g. citext) is
 * involved.
 */
public final class EmailNormalizer {

    private EmailNormalizer() {
    }

    /** Returns the canonical lower-case, trimmed form; {@code null} in, {@code null} out. */
    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(java.util.Locale.ROOT);
    }
}
