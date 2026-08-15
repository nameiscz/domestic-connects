package com.domesticconnects.job.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A worker's application to an OPEN job post. Workers apply instead of
 * self-assigning; the employer then accepts (which requires reviewing the
 * worker's profile and moves the post to {@code ASSIGNED}) or declines.
 * A worker may only hold one active application per job — enforced by a
 * unique constraint on {@code (job_id, worker_id)} — so re-applying to a
 * pending/declined job updates the existing row back to PENDING.
 */
@Entity
@Table(name = "job_applications",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_job_application", columnNames = {"job_id", "worker_id"}),
        indexes = @Index(name = "idx_application_job", columnList = "job_id"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobApplication {

    public enum ApplicationStatus {
        PENDING,
        ACCEPTED,
        DECLINED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Column(name = "worker_id", nullable = false)
    private Long workerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ApplicationStatus status = ApplicationStatus.PENDING;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
