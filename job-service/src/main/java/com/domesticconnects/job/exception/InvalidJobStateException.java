package com.domesticconnects.job.exception;

import com.domesticconnects.job.entity.JobStatus;

/**
 * Thrown when a job post is not in the state required for the requested
 * operation — e.g. assigning a worker to a job that is already
 * {@code ASSIGNED} or {@code CLOSED}. Mapped to HTTP 409 Conflict.
 */
public class InvalidJobStateException extends RuntimeException {

    public InvalidJobStateException(Long jobId, JobStatus currentStatus) {
        super(String.format(
                "Job %d cannot be assigned: current status is %s (only OPEN jobs can be assigned)",
                jobId, currentStatus));
    }
}
