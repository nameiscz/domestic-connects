package com.domesticconnects.attendance.controller;

import com.domesticconnects.attendance.dto.AttendanceRequest;
import com.domesticconnects.attendance.dto.AttendanceResponse;
import com.domesticconnects.attendance.dto.WorkerAttendanceReport;
import com.domesticconnects.attendance.exception.AccessDeniedException;
import com.domesticconnects.attendance.service.AttendanceService;
import com.domesticconnects.attendance.service.JobAssignmentVerifier;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

/**
 * Attendance endpoints. Authentication is performed by the API gateway, which
 * forwards the caller's role in the {@code X-User-Role} header (see the
 * {@code JwtAuthGlobalFilter}). Role checks below are applied against that
 * header — no Spring Security filter chain exists in this service.
 */
@RestController
@RequestMapping("/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_EMPLOYER = "EMPLOYER";
    private static final String ROLE_WORKER = "WORKER";

    private final AttendanceService attendanceService;
    private final JobAssignmentVerifier jobAssignmentVerifier;

    @PostMapping("/mark")
    public ResponseEntity<AttendanceResponse> markAttendance(
            @Valid @RequestBody AttendanceRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);
        // Employers may only mark attendance against their own jobs, and only
        // for the worker assigned to that job.
        if (extractUserRole(httpRequest).equalsIgnoreCase(ROLE_EMPLOYER)) {
            jobAssignmentVerifier.verifyEmployerCanMark(requireEmployerId(httpRequest), request);
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(attendanceService.markAttendance(request));
    }

    @GetMapping("/worker/{workerId}")
    public ResponseEntity<WorkerAttendanceReport> getWorkerAttendance(
            @PathVariable Long workerId,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            HttpServletRequest httpRequest) {
        String role = extractUserRole(httpRequest);
        if (ROLE_WORKER.equalsIgnoreCase(role)) {
            // Workers are only ever allowed to view their own attendance.
            requireSelfAccess(httpRequest, workerId);
        } else {
            requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);
            // Employers may only view attendance of workers they have hired.
            if (ROLE_EMPLOYER.equalsIgnoreCase(role)) {
                jobAssignmentVerifier.verifyEmployerCanView(
                        requireEmployerId(httpRequest), workerId);
            }
        }
        return ResponseEntity.ok(
                attendanceService.getWorkerAttendance(workerId, month, year));
    }

    @GetMapping("/workers")
    public ResponseEntity<List<Long>> getWorkersWithAttendance(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);
        List<Long> workerIds = attendanceService.getWorkerIdsWithAttendance(month, year);
        // Employers see only the ids of workers they have actually hired.
        if (extractUserRole(httpRequest).equalsIgnoreCase(ROLE_EMPLOYER)) {
            Set<Long> assigned = jobAssignmentVerifier.assignedWorkerIds(
                    requireEmployerId(httpRequest));
            workerIds = workerIds.stream().filter(assigned::contains).toList();
        }
        return ResponseEntity.ok(workerIds);
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
     * Verifies a WORKER caller is only accessing their own record. The gateway
     * forwards the authenticated user's id as {@code X-User-Id} (stripping any
     * client-supplied value first), so comparing it to the requested
     * {@code workerId} is safe. Throws {@link AccessDeniedException} (HTTP 403)
     * when the ids do not match.
     */
    private void requireSelfAccess(HttpServletRequest request, Long workerId) {
        String userId = extractUserId(request);
        if (!String.valueOf(workerId).equals(userId)) {
            throw new AccessDeniedException(
                    "Access denied: workers may only view their own attendance");
        }
    }

    /**
     * Reads the caller's user id. The gateway forwards it as {@code X-User-Id};
     * a missing header yields an empty string so the caller is treated as
     * unauthenticated.
     */
    private String extractUserId(HttpServletRequest request) {
        String userId = request.getHeader("X-User-Id");
        return userId == null ? "" : userId.trim();
    }

    /**
     * Parses the caller's id (the employer's user id) from the
     * gateway-forwarded {@code X-User-Id} header. Fails closed with
     * {@link AccessDeniedException} when the header is missing or non-numeric
     * so an employer-facing check can never accidentally pass for an
     * unidentified caller.
     */
    private Long requireEmployerId(HttpServletRequest request) {
        String userId = extractUserId(request);
        if (userId.isBlank()) {
            throw new AccessDeniedException(
                    "Access denied: unable to verify employer identity");
        }
        try {
            return Long.parseLong(userId.trim());
        } catch (NumberFormatException e) {
            throw new AccessDeniedException(
                    "Access denied: unable to verify employer identity");
        }
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
