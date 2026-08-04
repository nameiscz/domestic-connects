package com.domesticconnects.performance.audit;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One immutable audit-log row written by {@link AuditLogAspect} for every
 * {@link Auditable} method invocation.
 * <p>
 * The actor is the authenticated caller as forwarded by the API gateway
 * ({@code X-User-Id} / {@code X-User-Role} headers derived from JWT claims —
 * the gateway strips any client-supplied copies first, so these are trusted).
 * {@code oldValue} / {@code newValue} hold compact JSON summaries of the
 * pre-/post-change state (truncated by the aspect) so a reviewer can see
 * <i>what</i> changed without storing full payload copies.
 * <p>
 * The table is created automatically (schema {@code ddl-auto: update}),
 * one {@code audit_logs} table per service database.
 */
@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_entity", columnList = "entity_type, entity_id"),
        @Index(name = "idx_audit_actor", columnList = "actor_id"),
        @Index(name = "idx_audit_created", columnList = "created_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Caller's user id (from the gateway-forwarded {@code X-User-Id} header). */
    @Column(name = "actor_id", length = 100)
    private String actorId;

    /** Caller's role (from the gateway-forwarded {@code X-User-Role} header). */
    @Column(name = "actor_role", length = 50)
    private String actorRole;

    /** Business action, e.g. {@code CREATE}, {@code UPDATE}, {@code DELETE}. */
    @Column(nullable = false, length = 30)
    private String action;

    /** Entity type, e.g. {@code PerformanceReview}. */
    @Column(name = "entity_type", nullable = false, length = 100)
    private String entityType;

    /** Id of the affected entity (as text, to be id-type agnostic). */
    @Column(name = "entity_id", length = 100)
    private String entityId;

    /** JSON summary of the pre-change state (may be null). */
    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    /** JSON summary of the post-change state (may be null). */
    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    /** Free-text description plus, on failure, the thrown exception summary. */
    @Column(length = 500)
    private String detail;

    /** Whether the audited operation completed successfully. */
    @Column(nullable = false)
    @Builder.Default
    private boolean success = true;

    /** Timestamp of the audited operation. */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
