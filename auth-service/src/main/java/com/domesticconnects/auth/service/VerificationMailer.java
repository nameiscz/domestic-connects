package com.domesticconnects.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Sends email-verification messages through Resend's REST API
 * ({@code POST https://api.resend.com/emails} with a Bearer API key).
 * <p>
 * Best-effort by design: a missing API key or a mail API failure is logged and
 * swallowed so registration itself never fails. Without {@code RESEND_API_KEY}
 * the verification link is logged instead (local-dev fallback — the link is
 * still valid because auth-service's {@code /auth/verify/{token}} endpoint is
 * whitelisted at the gateway).
 */
@Component
public class VerificationMailer {

    private static final Logger log = LoggerFactory.getLogger(VerificationMailer.class);

    private static final String RESEND_URL = "https://api.resend.com/emails";

    private final RestClient restClient = RestClient.create();

    @Value("${mail.resend.api-key:}")
    private String apiKey;

    @Value("${mail.resend.from:Domestic Connects <onboarding@resend.dev>}")
    private String from;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    /**
     * Sends (or logs, in dev) the verification link for a freshly registered
     * user. Never throws — failures are logged and swallowed.
     *
     * @param email the recipient address
     * @param token the one-time verification token stored on the user
     */
    public void sendVerificationEmail(String email, String token) {
        String link = frontendUrl + "/verify?token=" + token;

        if (apiKey == null || apiKey.isBlank()) {
            // Dev fallback: no mailer configured — surface the link in the logs
            // so a local workflow still completes (integration tests read the
            // token from MySQL, so this never blocks them).
            log.info("RESEND_API_KEY not configured — verification link for {}:\n{}",
                    email, link);
            return;
        }

        try {
            restClient.post()
                    .uri(RESEND_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", from,
                            "to", new String[]{email},
                            "subject", "Verify your Domestic Connects account",
                            "html", verificationHtml(link)
                    ))
                    .retrieve()
                    .toBodilessEntity();

            log.info("Verification email sent to {}", email);
        } catch (Exception e) {
            // Never fail registration because the mailer misbehaves.
            log.warn("Failed to send verification email to {}: {}", email, e.getMessage());
        }
    }

    private String verificationHtml(String link) {
        return "<div style=\"font-family:Arial,sans-serif;max-width:480px;margin:0 auto;\">"
                + "<h2>Welcome to Domestic Connects!</h2>"
                + "<p>Thanks for creating an account. To activate it, click the button below:</p>"
                + "<p style=\"margin:24px 0;\">"
                + "<a href=\"" + link + "\" style=\"background:#0d6efd;color:#fff;"
                + "padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;\">"
                + "Verify my email</a></p>"
                + "<p style=\"color:#6c757d;font-size:13px;\">If the button doesn't work, copy and "
                + "paste this link into your browser:<br/>" + link + "</p>"
                + "</div>";
    }
}
