package com.domesticconnects.auth.controller;

import com.domesticconnects.auth.dto.*;
import com.domesticconnects.auth.service.AuthService;
import org.springframework.security.access.AccessDeniedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// wildcard imports cover all DTOs (UpdateProfileRequest, ChangePasswordRequest, etc.)

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_EMPLOYER = "EMPLOYER";

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refresh(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Starts the password-reset flow. Public — the caller only provides an
     * email. The one-time token and reset link are returned in the response
     * body (the project has no email provider yet).
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<PasswordResetResponse>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request.getEmail()));
    }

    /**
     * Sets a new password using the one-time token emailed/linked from
     * forgot-password. Public. The new password must satisfy the same policy
     * as registration (8–10 characters with upper, lower, digit, special).
     */
    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(
                authService.resetPassword(request.getToken(), request.getNewPassword()));
    }

    /**
     * Updates the authenticated user's profile (name, email, phone).
     * Requires a valid JWT token. Returns a refreshed auth response so the
     * frontend session can pick up the updated name/email.
     */
    @PutMapping("/profile")
    public ResponseEntity<AuthResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            HttpServletRequest httpRequest) {
        Long userId = extractUserId(httpRequest);
        return ResponseEntity.ok(authService.updateProfile(userId, request));
    }

    /**
     * Changes the authenticated user's password after verifying the current
     * password. Requires a valid JWT token.
     */
    @PutMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpRequest) {
        Long userId = extractUserId(httpRequest);
        return ResponseEntity.ok(authService.changePassword(userId, request));
    }

    /**
     * Lists active workers for the employer job-assignment picker.
     * The path is permitted at the security layer (see {@code SecurityConfig})
     * so direct Feign callers work; EMPLOYER/ADMIN authorisation is enforced
     * here against the gateway-forwarded {@code X-User-Role} header, matching
     * the pattern used by {@code AdminController}.
     */
    @GetMapping("/workers")
    public ResponseEntity<ApiResponse<List<AuthResponse.UserInfo>>> getWorkers(
            HttpServletRequest request) {
        requireRole(request, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.ok(authService.getWorkers());
    }

    /**
     * Extracts the caller's numeric user-ID from the gateway-forwarded
     * {@code X-User-Id} header (set by the JWT filter / gateway).
     */
    private Long extractUserId(HttpServletRequest request) {
        String raw = request.getHeader("X-User-Id");
        if (raw == null || raw.isBlank()) {
            throw new AccessDeniedException("Missing user-ID header");
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            throw new AccessDeniedException("Invalid user-ID header");
        }
    }

    /**
     * Verifies the caller's role (from the gateway-forwarded header) against
     * the allowed roles. Throws {@link AccessDeniedException} (HTTP 403) when
     * the role is missing or not permitted.
     */
    private void requireRole(HttpServletRequest request, String... allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || role.isBlank()) {
            role = request.getHeader("X-User-Roles");
        }
        if (role == null || role.isBlank()) {
            throw new AccessDeniedException("Access denied: requires one of roles "
                    + String.join(", ", allowedRoles));
        }
        for (String allowedRole : allowedRoles) {
            if (role.trim().equalsIgnoreCase(allowedRole)) {
                return;
            }
        }
        throw new AccessDeniedException("Access denied: requires one of roles "
                + String.join(", ", allowedRoles));
    }
}
