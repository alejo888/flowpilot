package com.flowpilot.dto;

public record AccessTokenResponse(String accessToken, long expiresIn) {
}
