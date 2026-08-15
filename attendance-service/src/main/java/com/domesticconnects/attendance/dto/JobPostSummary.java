package com.domesticconnects.attendance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Minimal mirror of {@code JobPostResponse} from job-service, containing only
 * the fields attendance-service needs to authorise an employer: who owns the
 * job, which worker is assigned to it, and its lifecycle status.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobPostSummary {

    private Long id;
    private Long employerId;

    /** Worker assigned to the post, or {@code null} while it is still OPEN. */
    private Long workerId;

    /**
     * Lifecycle status as returned by job-service ("OPEN", "ASSIGNED" or
     * "CLOSED") — kept as a String to avoid duplicating the enum.
     */
    private String status;
}
