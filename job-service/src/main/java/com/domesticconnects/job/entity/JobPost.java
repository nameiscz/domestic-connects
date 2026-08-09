package com.domesticconnects.job.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "job_posts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Long employerId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal wagePerDay;

    @Column(nullable = false, length = 150)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private JobStatus status = JobStatus.OPEN;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private boolean isDeleted = false;

    /**
     * Optimistic-lock version — managed by Hibernate, incremented on every
     * update. Concurrent updates to the same row fail fast with an
     * {@code ObjectOptimisticLockingFailureException} (mapped to HTTP 409)
     * instead of silently overwriting each other. The setter is deliberately
     * hidden so the lock version can only be touched by Hibernate.
     */
    @Version
    @Column(name = "version")
    @Setter(AccessLevel.NONE)
    private Long version;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = JobStatus.OPEN;
        }
    }
}
