package com.domesticconnects.attendance.service;

import com.domesticconnects.attendance.client.JobServiceClient;
import com.domesticconnects.attendance.dto.AttendanceRequest;
import com.domesticconnects.attendance.dto.JobPostSummary;
import com.domesticconnects.attendance.exception.AccessDeniedException;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Scopes employer attendance access to the workers they have actually hired.
 * <p>
 * The attendance table only records {@code workerId}/{@code jobId} — it holds
 * no notion of ownership — so the assignment relationship is verified against
 * job-service (the source of truth for {@code employerId}, {@code workerId}
 * and job status) on every employer-facing request:
 * <ul>
 *   <li>Marking requires the job to be the caller's own, currently ASSIGNED,
 *       and assigned to the exact worker in the request.</li>
 *   <li>Viewing a worker's report requires that worker to be assigned to at
 *       least one of the caller's jobs.</li>
 * </ul>
 * Admins bypass these checks entirely (they already manage all workers).
 */
@Component
@RequiredArgsConstructor
public class JobAssignmentVerifier {

    private static final String STATUS_ASSIGNED = "ASSIGNED";

    private final JobServiceClient jobServiceClient;

    /**
     * Verifies an employer may mark attendance in the given request: the job
     * must exist, belong to the employer, be currently {@code ASSIGNED}, and
     * be assigned to the request's worker. Anything else is treated as an
     * {@link AccessDeniedException} (HTTP 403) so a caller cannot probe which
     * jobs or workers exist.
     */
    public void verifyEmployerCanMark(Long employerId, AttendanceRequest request) {
        JobPostSummary job;
        try {
            job = jobServiceClient.getJobPost(request.getJobId());
        } catch (FeignException.NotFound e) {
            throw new AccessDeniedException(deniedMessage());
        }

        if (job == null
                || !employerId.equals(job.getEmployerId())
                || !request.getWorkerId().equals(job.getWorkerId())
                || !STATUS_ASSIGNED.equalsIgnoreCase(job.getStatus())) {
            throw new AccessDeniedException(deniedMessage());
        }
    }

    /**
     * Verifies an employer may view attendance for the given worker — i.e. the
     * worker is assigned to at least one of the employer's jobs.
     */
    public void verifyEmployerCanView(Long employerId, Long workerId) {
        if (!assignedWorkerIds(employerId).contains(workerId)) {
            throw new AccessDeniedException(deniedMessage());
        }
    }

    /**
     * Distinct worker ids the employer has hired. Used to filter bulk
     * responses (e.g. the monthly worker list) down to the caller's own
     * assignees.
     */
    public Set<Long> assignedWorkerIds(Long employerId) {
        List<Long> ids = jobServiceClient.getAssignedWorkerIds(employerId);
        return ids == null ? Set.of() : ids.stream().collect(Collectors.toSet());
    }

    private String deniedMessage() {
        return "Access denied: attendance may only be managed for workers "
                + "assigned to your own jobs";
    }
}
