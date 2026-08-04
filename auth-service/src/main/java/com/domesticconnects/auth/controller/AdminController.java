package com.domesticconnects.auth.controller;

import com.domesticconnects.auth.dto.ApiResponse;
import com.domesticconnects.auth.dto.AuthResponse;
import com.domesticconnects.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/auth/admin/users")
@RequiredArgsConstructor
public class AdminController {

    private static final String ROLE_ADMIN = "ADMIN";

    private final AuthService authService;

    /**
     * Read-only listing of all users, consumed by admin-service for the
     * dashboard (user count, users-by-role breakdown). The path is permitted
     * at the security layer so admin-service can call it over direct Feign
     * without a JWT; ADMIN authorisation is enforced here against the
     * gateway-forwarded {@code X-User-Role} header, matching the pattern used
     * by the other services.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<AuthResponse.UserInfo>>> getAllUsers(
            HttpServletRequest request) {
        requireAdmin(request);
        return ResponseEntity.ok(authService.getAllUsers());
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> activateUser(@PathVariable Long id) {
        ApiResponse<Void> response = authService.activateUser(id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(@PathVariable Long id) {
        ApiResponse<Void> response = authService.deactivateUser(id);
        return ResponseEntity.ok(response);
    }

    /**
     * Verifies the caller's role (from the gateway-forwarded header) is
     * {@code ADMIN}. Throws {@link AccessDeniedException} (HTTP 403) when the
     * role is missing or not permitted.
     */
    private void requireAdmin(HttpServletRequest request) {
        String role = request.getHeader("X-User-Role");
        if (role == null || role.isBlank()) {
            role = request.getHeader("X-User-Roles");
        }
        if (role == null || !ROLE_ADMIN.equalsIgnoreCase(role.trim())) {
            throw new AccessDeniedException("Access denied: requires ADMIN role");
        }
    }
}
