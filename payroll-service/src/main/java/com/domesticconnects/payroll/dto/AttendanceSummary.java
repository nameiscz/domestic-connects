package com.domesticconnects.payroll.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Mirror of {@code com.domesticconnects.attendance.dto.AttendanceSummary} —
 * carries the present-day count used for salary calculation.
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
