package com.domesticconnects.job.repository;

import com.domesticconnects.job.entity.JobPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link JobPost}.
 * <p>
 * Soft-deleted rows ({@code isDeleted = true}) are excluded by default from
 * every query exposed here; the inherited {@link JpaRepository} methods
 * (e.g. {@code findById}) must not be used for business lookups.
 */
@Repository
public interface JobPostRepository extends JpaRepository<JobPost, Long> {

    @Query("SELECT j FROM JobPost j WHERE j.isDeleted = false")
    List<JobPost> findAllActive();

    @Query("SELECT j FROM JobPost j WHERE j.id = :id AND j.isDeleted = false")
    Optional<JobPost> findActiveById(@Param("id") Long id);

    /**
     * Distinct worker ids with an ASSIGNED job post for the given employer —
     * i.e. the workers that employer has actually hired. Consumed by
     * attendance-service to scope an employer's attendance access to their
     * own assignees only.
     */
    @Query("SELECT DISTINCT j.workerId FROM JobPost j "
            + "WHERE j.isDeleted = false "
            + "AND j.employerId = :employerId "
            + "AND j.workerId IS NOT NULL "
            + "AND j.status = com.domesticconnects.job.entity.JobStatus.ASSIGNED")
    List<Long> findAssignedWorkerIdsByEmployerId(@Param("employerId") Long employerId);
}
