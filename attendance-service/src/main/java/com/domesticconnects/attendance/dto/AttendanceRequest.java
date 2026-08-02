package com.domesticconnects.attendance.dto;

import com.domesticconnects.attendance.entity.AttendanceStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AttendanceRequest {

    @NotNull(message = "Worker ID is required")
    @Positive(message = "Worker ID must be a positive number")
    private Long workerId;

    @NotNull(message = "Job ID is required")
    @Positive(message = "Job ID must be a positive number")
    private Long jobId;

    @NotNull(message = "Date is required")
    private LocalDate date;

    @NotNull(message = "Status is required")
    private AttendanceStatus status;
}
