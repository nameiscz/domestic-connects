package com.domesticconnects.performance.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Check;

import java.time.LocalDateTime;

/**
 * A single performance review of a {@code workerId} by an employer/admin.
 * <p>
 * The rating is a whole number between 1 and 5, enforced at three levels:
 * bean validation on the DTOs, the service layer, and a database check
 * constraint (defence in depth). {@code version} provides optimistic locking
 * so concurrent edits fail fast with a conflict instead of silently
 * overwriting each other. Remarks are optional free-form feedback capped at
 * 1000 characters.
 */
@Entity
@Table(name = "performance_review",
        indexes = @Index(name = "idx_performance_review_worker", columnList = "worker_id"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PerformanceReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "worker_id", nullable = false)
    private Long workerId;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Check(constraints = "rating >= 1 AND rating <= 5")
    @Column(nullable = false)
    private Integer rating;

    @Column(length = 1000)
    private String remarks;

    @Column(name = "reviewed_by", nullable = false, length = 100)
    private String reviewedBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Optimistic-lock token, incremented by Hibernate on every update.
     * Concurrent stale updates fail with {@code OptimisticLockException}.
     */
    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
