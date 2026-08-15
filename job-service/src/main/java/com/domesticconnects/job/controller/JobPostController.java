package com.domesticconnects.job.controller;

import com.domesticconnects.job.dto.ApiResponse;
import com.domesticconnects.job.dto.JobApplicationResponse;
import com.domesticconnects.job.dto.JobPostRequest;
import com.domesticconnects.job.dto.JobPostResponse;
import com.domesticconnects.job.exception.AccessDeniedException;
import com.domesticconnects.job.exception.JobStatusException;
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
    private static final String ROLE_WORKER = "WORKER";

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

    /**
     * Distinct worker ids assigned to the employer's active job posts. Used by
     * attendance-service to scope an employer's attendance access to only the
     * workers they have hired. Callers may only query their own employer id
     * (the gateway forwards it, so the response is the caller's own data).
     */
    @GetMapping("/employer/{employerId}/workers")
    public ResponseEntity<List<Long>> getAssignedWorkers(
            @PathVariable Long employerId,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.ok(jobPostService.getAssignedWorkerIds(employerId));
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
        requireRole(httpRequest, ROLE_WORKER, ROLE_EMPLOYER, ROLE_ADMIN);

        // A WORKER may only "apply" by assigning themselves — assigning other
        // workers remains an employer/admin privilege.
        if (extractUserRole(httpRequest).equalsIgnoreCase(ROLE_WORKER)) {
            requireSelfAssignment(httpRequest, workerId);
            return ResponseEntity.ok(jobPostService.assignWorker(id, workerId));
        }

        // Employers and admins must review the worker's profile before
        // assigning: they are required to use the reviewed endpoint below.
        throw new AccessDeniedException(
                "Access denied: employers must review the worker's profile before "
                        + "assigning — use POST /jobs/{id}/assign/{workerId}/reviewed");
    }

    /**
     * Assigns a worker after the employer (or admin) reviewed their profile.
     * The post is marked {@code profileReviewed} so downstream tooling can
     * distinguish employer-reviewed assignments from worker self-applications.
     * Workers cannot use this path — they apply via the plain assign endpoint.
     */
    @PostMapping("/{id}/assign/{workerId}/reviewed")
    public ResponseEntity<JobPostResponse> assignWorkerReviewed(
            @PathVariable Long id,
            @PathVariable Long workerId,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.ok(jobPostService.assignWorkerReviewed(id, workerId));
    }

    /**
     * A worker applies to an OPEN job. Unlike the plain assign endpoint, this
     * does <b>not</b> assign — it records a PENDING application the employer
     * can review (worker profile) and accept or decline.
     */
    @PostMapping("/{id}/apply")
    public ResponseEntity<JobApplicationResponse> applyToJob(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_WORKER);
        Long workerId = extractUserId(httpRequest);
        if (workerId == null) {
            throw new AccessDeniedException(
                    "Access denied: unable to verify worker identity");
        }
        JobApplicationResponse application = jobPostService.applyToJob(id, workerId);
        if (application == null) {
            // Job already assigned/closed and no pending row to update.
            throw new JobStatusException(
                    "This job is no longer accepting applications.");
        }
        return ResponseEntity.ok(application);
    }

    /**
     * The applicant list for one of the employer's job posts.
     */
    @GetMapping("/{id}/applications")
    public ResponseEntity<List<JobApplicationResponse>> getJobApplications(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.ok(jobPostService.getJobApplications(id));
    }

    /**
     * Accepts a worker's application. The employer has reviewed the worker's
     * profile (the frontend shows it before accepting), so the post is marked
     * {@code profileReviewed} and moves to ASSIGNED.
     */
    @PostMapping("/{id}/applications/{applicationId}/accept")
    public ResponseEntity<JobPostResponse> acceptApplication(
            @PathVariable Long id,
            @PathVariable Long applicationId,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.ok(jobPostService.acceptApplication(id, applicationId));
    }

    /**
     * Declines a worker's application; the job stays OPEN.
     */
    @PostMapping("/{id}/applications/{applicationId}/decline")
    public ResponseEntity<JobApplicationResponse> declineApplication(
            @PathVariable Long id,
            @PathVariable Long applicationId,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_EMPLOYER, ROLE_ADMIN);
        return ResponseEntity.ok(jobPostService.declineApplication(id, applicationId));
    }

    /**
     * Enforces that a WORKER may only assign themselves to a job (i.e. apply).
     * The caller's id is read from the gateway-forwarded {@code X-User-Id}
     * header, which the gateway derives from the validated JWT and strips from
     * any client-supplied input, so it cannot be forged.
     */
    private void requireSelfAssignment(HttpServletRequest request, Long workerId) {
        String userId = request.getHeader("X-User-Id");
        if (userId == null || userId.isBlank()) {
            throw new AccessDeniedException("Access denied: unable to verify worker identity");
        }
        try {
            if (Long.parseLong(userId.trim()) != workerId.longValue()) {
                throw new AccessDeniedException(
                        "Access denied: workers may only apply to jobs for themselves");
            }
        } catch (NumberFormatException e) {
            throw new AccessDeniedException("Access denied: unable to verify worker identity");
        }
    }

    /**
     * Reads the caller's user id from the gateway-forwarded {@code X-User-Id}
     * header. Returns {@code null} when absent or not numeric, so identity
     * checks fail closed.
     */
    private Long extractUserId(HttpServletRequest request) {
        String userId = request.getHeader("X-User-Id");
        if (userId == null || userId.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(userId.trim());
        } catch (NumberFormatException e) {
            return null;
        }
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
