package com.domesticconnects.job.controller;

import com.domesticconnects.job.dto.ApiResponse;
import com.domesticconnects.job.dto.JobPostRequest;
import com.domesticconnects.job.dto.JobPostResponse;
import com.domesticconnects.job.exception.AccessDeniedException;
import com.domesticconnects.job.service.JobPostService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

/**
 * Job post endpoints. Authentication is performed by the API gateway, which
 * forwards the caller's role in the {@code X-User-Role} header (see the
 * {@code JwtAuthGlobalFilter}). Role checks below are applied against that
 * header — no Spring Security filter chain exists in this service.
 */
@RestController
@RequestMapping("/jobs")
@RequiredArgsConstructor
public class JobPostController {

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_EMPLOYER = "EMPLOYER";

    private final JobPostService jobPostService;

    @PostMapping
    public ResponseEntity<JobPostResponse> createJobPost(
            @Valid @RequestBody JobPostRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(jobPostService.createJobPost(request));
    }

    @GetMapping
    public ResponseEntity<List<JobPostResponse>> getAllJobPosts() {
        return ResponseEntity.ok(jobPostService.getAllJobPosts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<JobPostResponse> getJobPost(@PathVariable Long id) {
        return ResponseEntity.ok(jobPostService.getJobPost(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<JobPostResponse> updateJobPost(
            @PathVariable Long id,
            @Valid @RequestBody JobPostRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.ok(jobPostService.updateJobPost(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteJobPost(@PathVariable Long id,
                                                           HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        jobPostService.softDeleteJobPost(id);
        return ResponseEntity.ok(ApiResponse.success("Job post deleted successfully", null));
    }

    @PostMapping("/{id}/assign/{workerId}")
    public ResponseEntity<JobPostResponse> assignWorker(@PathVariable Long id,
                                                        @PathVariable Long workerId,
                                                        HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.ok(jobPostService.assignWorker(id, workerId));
    }

    /**
     * Verifies the caller's role (from the gateway-forwarded header) against
     * the allowed roles. Throws {@link AccessDeniedException} (HTTP 403) when
     * the role is missing or not permitted.
     */
    private void requireRole(HttpServletRequest request, String... allowedRoles) {
        String role = extractUserRole(request);
        for (String allowedRole : allowedRoles) {
            if (role.equalsIgnoreCase(allowedRole)) {
                return;
            }
        }
        throw new AccessDeniedException(
                "Access denied: requires one of roles " + Arrays.toString(allowedRoles));
    }

    /**
     * Reads the caller's role. The gateway forwards it as {@code X-User-Role};
     * {@code X-User-Roles} is tolerated as a fallback for older gateway builds.
     * A missing header yields an empty string so the caller is treated as
     * unauthenticated.
     */
    private String extractUserRole(HttpServletRequest request) {
        String role = request.getHeader("X-User-Role");
        if (role == null || role.isBlank()) {
            role = request.getHeader("X-User-Roles");
        }
        return role == null ? "" : role.trim();
    }
}
