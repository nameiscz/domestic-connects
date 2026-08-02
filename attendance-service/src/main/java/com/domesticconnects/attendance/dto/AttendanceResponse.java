package com.domesticconnects.attendance.dto;

import com.domesticconnects.attendance.entity.AttendanceStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

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
