package com.domesticconnects.job.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for {@link AuditLog}. Exposes the query shapes most commonly
 * needed by admin/compliance screens: per entity, per actor, and per time
 * window — each newest-first.
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    /** All audit rows for one entity instance, newest first. */
    List<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(
            String entityType, String entityId);

    /** All audit rows for one actor, newest first. */
    List<AuditLog> findByActorIdOrderByCreatedAtDesc(String actorId);

    /** All audit rows within an inclusive time window, newest first. */
    List<AuditLog> findByCreatedAtBetweenOrderByCreatedAtDesc(
            LocalDateTime from, LocalDateTime to);
}
