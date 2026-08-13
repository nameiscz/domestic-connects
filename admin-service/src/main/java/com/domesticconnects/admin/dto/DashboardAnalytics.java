package com.domesticconnects.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * Payload for {@code GET /admin/dashboard/analytics}:
 * <ul>
 *   <li>{@code usersByRole} — total users grouped by role (ADMIN/WORKER/EMPLOYER)</li>
 *   <li>{@code jobsByStatus} — jobs grouped by status (OPEN/ASSIGNED/CLOSED)</li>
 *   <li>{@code activeJobs} vs {@code inactiveJobs} — OPEN+ASSIGNED vs CLOSED</li>
 *   <li>{@code monthlyAttendanceRate} — current month, percentage (0-100)</li>
 *   <li>{@code averagePerformanceRating} — across workers (1-5)</li>
 * </ul>
 * Metrics are computed with circuit-breaker safe fallbacks: a failed
 * downstream resolves to an empty map / zero / {@code null}.
 */
@Data
@Builder
public class DashboardAnalytics {

    private Map<String, Long> usersByRole;
    private Map<String, Long> jobsByStatus;
    private long activeJobs;
    private long inactiveJobs;
    private Double monthlyAttendanceRate;
    private Double averagePerformanceRating;
    /** Total performance reviews submitted across all workers. */
    private long totalReviews;
}
