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

    @PostMapping("/verify/{token}")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@PathVariable String token) {
        ApiResponse<Void> response = authService.verifyEmail(token);
        return ResponseEntity.ok(response);
    }

    /**
     * Lists verified, active workers for the employer job-assignment picker.
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
