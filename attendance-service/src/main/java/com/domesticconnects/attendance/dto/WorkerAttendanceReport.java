package com.domesticconnects.attendance.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Payload returned by {@code GET /attendance/worker/{workerId}}: the worker's
 * attendance records for the requested month together with a summary.
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
