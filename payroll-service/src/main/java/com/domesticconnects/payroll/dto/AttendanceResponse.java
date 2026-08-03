package com.domesticconnects.payroll.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Mirror of {@code com.domesticconnects.attendance.dto.AttendanceResponse}.
 */
@Data
@Builder
public class AttendanceResponse {

    private Long id;
    private Long workerId;
    private Long jobId;
    private LocalDate date;
    private AttendanceStatus status;
    private LocalDateTime createdAt;
}
