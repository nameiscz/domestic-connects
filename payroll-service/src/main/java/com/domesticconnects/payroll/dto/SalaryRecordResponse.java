package com.domesticconnects.payroll.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Payload returned by the salary history endpoint — a persisted
 * {@code SalaryRecord} without any entity leakage.
 */
@Data
@Builder
public class SalaryRecordResponse {

    private Long id;
    private Long workerId;
    private String workerName;
    private Integer month;
    private Integer year;
    private Integer presentDays;
    private Integer halfDays;
    private BigDecimal wagePerDay;
    private BigDecimal grossSalary;
    private LocalDateTime generatedAt;
}
