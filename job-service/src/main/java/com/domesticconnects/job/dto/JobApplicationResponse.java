package com.domesticconnects.job.dto;

import com.domesticconnects.job.entity.JobApplication.ApplicationStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * One job application as seen by the employer's applicant list (or the
 * worker's own "applied" acknowledgement). {@code workerName} is resolved by
 * the frontend from the auth-service worker directory when present.
 */
@Data
@Builder
public class JobApplicationResponse {

    private Long id;
    private Long jobId;
    private String jobTitle;
    private Long workerId;
    private ApplicationStatus status;
    private LocalDateTime createdAt;
}
