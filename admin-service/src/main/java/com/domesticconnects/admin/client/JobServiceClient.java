package com.domesticconnects.admin.client;

import com.domesticconnects.admin.config.AdminFeignConfig;
import com.domesticconnects.admin.dto.JobPostResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

/**
 * OpenFeign client for job-service, used to list all job posts for the
 * dashboard (status breakdown, active vs inactive counts).
 */
@FeignClient(name = "job-service", configuration = AdminFeignConfig.class)
public interface JobServiceClient {

    @GetMapping("/jobs")
    List<JobPostResponse> getAllJobPosts();
}
