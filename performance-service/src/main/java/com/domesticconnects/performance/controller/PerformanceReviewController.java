package com.domesticconnects.performance.controller;

import com.domesticconnects.performance.dto.ApiResponse;
import com.domesticconnects.performance.dto.PerformanceReviewRequest;
import com.domesticconnects.performance.dto.PerformanceReviewResponse;
import com.domesticconnects.performance.dto.PerformanceReviewUpdateRequest;
import com.domesticconnects.performance.dto.WorkerPerformanceReport;
import com.domesticconnects.performance.exception.AccessDeniedException;
import com.domesticconnects.performance.service.PerformanceReviewService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;

/**
 * Performance review endpoints. Authentication is performed by the API gateway,
 * which forwards the caller's role in the {@code X-User-Role} header (see the
 * {@code JwtAuthGlobalFilter}). Role checks below are applied against that
 * header — no Spring Security filter chain exists in this service.
 */
@RestController
@RequestMapping("/performance")
@RequiredArgsConstructor
public class PerformanceReviewController {

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_EMPLOYER = "EMPLOYER";
    private static final String ROLE_WORKER = "WORKER";

    private final PerformanceReviewService performanceReviewService;

    /**
     * Submitting a review is a write operation, restricted to admins and
     * employers (who supervise workers).
     */
    @PostMapping("/review")
    public ResponseEntity<PerformanceReviewResponse> submitReview(
            @Valid @RequestBody PerformanceReviewRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(performanceReviewService.submitReview(request));
    }

    /**
     * Reading performance is allowed for admins and employers (any worker),
     * and for workers viewing their <b>own</b> reviews — ownership is enforced
     * by matching the gateway-forwarded {@code X-User-Id} against the
     * requested {@code workerId}.
     */
    @GetMapping("/worker/{workerId}")
    public ResponseEntity<WorkerPerformanceReport> getWorkerPerformance(
            @PathVariable Long workerId,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER, ROLE_WORKER);
        requireOwnershipForWorker(httpRequest, workerId);
        return ResponseEntity.ok(performanceReviewService.getWorkerPerformance(workerId));
    }

    /**
     * Updates an existing review (rating/remarks). Editing is a write operation
     * like creation, restricted to admins and employers. Returns 404 when the
     * review does not exist.
     */
    @PutMapping("/review/{id}")
    public ResponseEntity<PerformanceReviewResponse> updateReview(
            @PathVariable Long id,
            @Valid @RequestBody PerformanceReviewUpdateRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);
        return ResponseEntity.ok(performanceReviewService.updateReview(id, request));
    }

    /**
     * Permanently deletes a review. Destructive operation restricted to
     * admins. Returns 404 when the review does not exist.
     */
    @DeleteMapping("/review/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteReview(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN);
        performanceReviewService.deleteReview(id);
        return ResponseEntity.ok(ApiResponse.success(
                "Performance review deleted successfully", null));
    }

    /**
     * Paginated review history. Returns the same {@link WorkerPerformanceReport}
     * payload as {@link #getWorkerPerformance} with the {@code reviews} list
     * sliced to the requested page. {@code page} is 0-based; {@code size}
     * defaults to 10 and is capped at 100.
     */
    @GetMapping("/worker/{workerId}/history")
    public ResponseEntity<WorkerPerformanceReport> getWorkerPerformanceHistory(
            @PathVariable Long workerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER, ROLE_WORKER);
        requireOwnershipForWorker(httpRequest, workerId);
        return ResponseEntity.ok(
                performanceReviewService.getWorkerHistory(workerId, page, size));
    }

    /**
     * When the caller is a worker, they may only read their own reviews: the
     * gateway-forwarded {@code X-User-Id} (the validated JWT's {@code userId})
     * must equal the requested {@code workerId}. Admins and employers are
     * exempt.
     */
    private void requireOwnershipForWorker(HttpServletRequest request, Long workerId) {
        if (!ROLE_WORKER.equalsIgnoreCase(extractUserRole(request))) {
            return;
        }
        String userId = request.getHeader("X-User-Id");
        if (userId == null || userId.isBlank()
                || !userId.trim().equals(String.valueOf(workerId))) {
            throw new AccessDeniedException(
                    "Access denied: workers can only view their own performance reviews");
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
