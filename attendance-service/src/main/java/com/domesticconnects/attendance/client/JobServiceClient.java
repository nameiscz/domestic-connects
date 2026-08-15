package com.domesticconnects.attendance.client;

import com.domesticconnects.attendance.config.JobServiceFeignConfig;
import com.domesticconnects.attendance.dto.JobPostSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

/**
 * OpenFeign client for job-service.
 * <p>
 * Resolved through Eureka by service name; {@link JobServiceFeignConfig} adds
 * the {@code X-User-Role} header (internal {@code ADMIN}) the job endpoints
 * require for direct service-to-service calls that bypass the gateway.
 */
@FeignClient(name = "job-service", configuration = JobServiceFeignConfig.class)
public interface JobServiceClient {

    /**
     * Distinct worker ids currently assigned to the employer's job posts —
     * the set of workers the employer is allowed to manage attendance for.
     */
    @GetMapping("/jobs/employer/{employerId}/workers")
    List<Long> getAssignedWorkerIds(@PathVariable("employerId") Long employerId);

    /**
     * A single job post, used to verify an attendance-marking request targets
     * the caller's own ASSIGNED job with the right worker.
     */
    @GetMapping("/jobs/{id}")
    JobPostSummary getJobPost(@PathVariable("id") Long id);
}
