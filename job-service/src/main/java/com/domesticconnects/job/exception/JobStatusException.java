package com.domesticconnects.job.exception;

/**
 * Thrown when a job post cannot transition to the requested state,
 * e.g. assigning a worker to a closed post. Mapped to HTTP 400.
 */
public class JobStatusException extends RuntimeException {

    public JobStatusException(String message) {
        super(message);
    }
}
