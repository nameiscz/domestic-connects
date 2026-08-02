package com.domesticconnects.attendance.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One attendance record: the daily attendance of a {@code workerId} on a
 * given date, optionally linked to the {@code jobId} they were assigned to.
 * <p>
 * A worker may only have a single record per date — enforced both in the
 * service layer and by the database-level unique constraint
 * {@code uk_attendance_worker_date}.
 */
@Entity
@Table(name = "attendance",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_attendance_worker_date",
                columnNames = {"worker_id", "attendance_date"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "worker_id", nullable = false)
    private Long workerId;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Column(name = "attendance_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private AttendanceStatus status = AttendanceStatus.PRESENT;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = AttendanceStatus.PRESENT;
        }
    }
}
