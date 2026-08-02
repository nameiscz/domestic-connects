package com.domesticconnects.attendance.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Aggregated counts for a worker's attendance in a given month.
 */
@Data
@Builder
public class AttendanceSummary {

    private Long workerId;
    private Integer month;
    private Integer year;
    private long presentDays;
    private long absentDays;
    private long halfDays;
    private long totalDays;
}
