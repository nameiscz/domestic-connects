package com.domesticconnects.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Payload for {@code GET /admin/dashboard/summary} — high-level counts plus
 * the headline this-month metrics, all computed with circuit-breaker safe
 * fallbacks (a failed downstream resolves to zero / {@code null}).
 */
@Data
@Builder
public class DashboardSummary {

    private long totalUsers;
    private long activeUsers;
    private long totalJobs;
    private long activeJobs;
    private long inactiveJobs;
    /** Attendance rate for the current month as a percentage (0-100), or null when unavailable. */
    private Double monthlyAttendanceRate;
    /** Average performance rating across workers (1-5), or null when unavailable. */
    private Double averagePerformanceRating;
    private LocalDateTime generatedAt;
}
