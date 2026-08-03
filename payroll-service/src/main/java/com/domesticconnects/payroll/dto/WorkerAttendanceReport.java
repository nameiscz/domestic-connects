package com.domesticconnects.payroll.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Mirror of {@code com.domesticconnects.attendance.dto.WorkerAttendanceReport}.
 */
@Data
@Builder
public class WorkerAttendanceReport {

    private Long workerId;
    private Integer month;
    private Integer year;
    private List<AttendanceResponse> records;
    private AttendanceSummary summary;
}
