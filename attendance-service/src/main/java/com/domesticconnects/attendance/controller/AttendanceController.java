package com.domesticconnects.attendance.controller;

import com.domesticconnects.attendance.dto.AttendanceRequest;
import com.domesticconnects.attendance.dto.AttendanceResponse;
import com.domesticconnects.attendance.dto.WorkerAttendanceReport;
import com.domesticconnects.attendance.exception.AccessDeniedException;
import com.domesticconnects.attendance.service.AttendanceService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

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

    private final AttendanceService attendanceService;

    @PostMapping("/mark")
    public ResponseEntity<AttendanceResponse> markAttendance(
            @Valid @RequestBody AttendanceRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(attendanceService.markAttendance(request));
    }

    @GetMapping("/worker/{workerId}")
    public ResponseEntity<WorkerAttendanceReport> getWorkerAttendance(
            @PathVariable Long workerId,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);
        return ResponseEntity.ok(
                attendanceService.getWorkerAttendance(workerId, month, year));
    }

    @GetMapping("/workers")
    public ResponseEntity<List<Long>> getWorkersWithAttendance(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);
        return ResponseEntity.ok(
                attendanceService.getWorkerIdsWithAttendance(month, year));
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
