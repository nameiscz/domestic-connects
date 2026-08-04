package com.domesticconnects.attendance.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persistence entry point for audit rows, intentionally kept as a separate
 * bean (rather than letting the aspect talk to the repository directly) so
 * the save runs through the Spring proxy and its transaction semantics apply.
 * <p>
 * The save uses {@code REQUIRES_NEW}: the audit row commits in its own
 * transaction and therefore survives even when the audited business
 * transaction rolls back — failed attempts are still recorded.
 */
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Persists an audit entry. Executes in a new transaction when a business
     * transaction is already active (see class javadoc).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(AuditLog auditLog) {
        auditLogRepository.save(auditLog);
    }
}
