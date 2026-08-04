package com.domesticconnects.admin.controller;

import com.domesticconnects.admin.dto.ApiResponse;
import com.domesticconnects.admin.dto.DashboardAnalytics;
import com.domesticconnects.admin.dto.DashboardSummary;
import com.domesticconnects.admin.dto.JobPostResponse;
import com.domesticconnects.admin.dto.UserInfo;
import com.domesticconnects.admin.exception.AccessDeniedException;
import com.domesticconnects.admin.service.AdminService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin dashboard endpoints (routed through the gateway at
 * {@code /api/admin/**}). Authentication is performed by the API gateway,
 * which forwards the caller's role in the {@code X-User-Role} header (see
 * {@code JwtAuthGlobalFilter}); this controller additionally requires the
 * {@code ADMIN} role as defence in depth.
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private static final String ROLE_ADMIN = "ADMIN";

    private final AdminService adminService;

    @GetMapping("/dashboard/summary")
    public ResponseEntity<ApiResponse<DashboardSummary>> getDashboardSummary(HttpServletRequest request) {
        requireAdmin(request);
        return ResponseEntity.ok(ApiResponse.success(
                "Dashboard summary generated", adminService.getDashboardSummary()));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserInfo>>> getUsers(HttpServletRequest request) {
        requireAdmin(request);
        return ResponseEntity.ok(ApiResponse.success(
                "Users fetched successfully", adminService.getUsers()));
    }

    @GetMapping("/jobs")
    public ResponseEntity<ApiResponse<List<JobPostResponse>>> getJobs(HttpServletRequest request) {
        requireAdmin(request);
        return ResponseEntity.ok(ApiResponse.success(
                "Jobs fetched successfully", adminService.getJobs()));
    }

    @GetMapping("/dashboard/analytics")
    public ResponseEntity<ApiResponse<DashboardAnalytics>> getDashboardAnalytics(HttpServletRequest request) {
        requireAdmin(request);
        return ResponseEntity.ok(ApiResponse.success(
                "Dashboard analytics generated", adminService.getDashboardAnalytics()));
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
