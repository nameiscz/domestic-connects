package com.domesticconnects.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload returned by POST /auth/forgot-password. The project has no email
 * provider yet, so the raw one-time token and a ready-to-open reset link are
 * returned in the response body (and logged by the service). Once SMTP is
 * wired up, this becomes the fallback delivery channel.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetResponse {

    private String token;

    private String resetLink;

    private long expiresInMinutes;
}
