package com.domesticconnects.payroll.client;

import com.domesticconnects.payroll.dto.JobPostResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * OpenFeign client for job-service, used to fetch the worker's {@code wagePerDay}
 * from the job post they are assigned to.
 */
@FeignClient(name = "job-service")
public interface JobServiceClient {

    @GetMapping("/jobs/{id}")
    JobPostResponse getJobPost(@PathVariable("id") Long id);
}
