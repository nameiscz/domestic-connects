package com.domesticconnects.payroll.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One row of payroll history: a generated monthly salary slip for a worker.
 * A new record is written every time a slip is generated, preserving history.
 */
@Entity
@Table(name = "salary_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SalaryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "worker_id", nullable = false)
    private Long workerId;

    @Column(name = "worker_name", length = 150)
    private String workerName;

    @Column(name = "payroll_month", nullable = false)
    private Integer month;

    @Column(name = "payroll_year", nullable = false)
    private Integer year;

    @Column(name = "present_days", nullable = false)
    private Integer presentDays;

    /**
     * Number of HALF_DAY attendances; each counts as 0.5 paid days. Nullable so
     * that rows created before this field existed remain readable.
     */
    @Column(name = "half_days")
    private Integer halfDays;

    @Column(name = "wage_per_day", nullable = false, precision = 10, scale = 2)
    private BigDecimal wagePerDay;

    @Column(name = "gross_salary", nullable = false, precision = 12, scale = 2)
    private BigDecimal grossSalary;

    @Column(nullable = false, updatable = false)
    private LocalDateTime generatedAt;

    @PrePersist
    protected void onCreate() {
        this.generatedAt = LocalDateTime.now();
    }
}
