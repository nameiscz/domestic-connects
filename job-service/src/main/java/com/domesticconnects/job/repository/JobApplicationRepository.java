package com.domesticconnects.job.repository;

import com.domesticconnects.job.entity.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {

    /** All applications for a job post, newest first (employer's applicant list). */
    List<JobApplication> findByJobIdOrderByCreatedAtDesc(Long jobId);

    /** A worker's single application row per job (unique on job + worker). */
    Optional<JobApplication> findByJobIdAndWorkerId(Long jobId, Long workerId);

    /** Whether the worker has an active application to a job (for the UI state). */
    Optional<JobApplication> findFirstByJobIdAndWorkerIdOrderByCreatedAtDesc(Long jobId, Long workerId);
}
