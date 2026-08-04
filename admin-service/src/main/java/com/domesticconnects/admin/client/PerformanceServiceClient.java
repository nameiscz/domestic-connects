package com.domesticconnects.admin.client;

import com.domesticconnects.admin.config.AdminFeignConfig;
import com.domesticconnects.admin.dto.WorkerPerformanceReport;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * OpenFeign client for performance-service, used to fetch each worker's
 * average rating for dashboard analytics.
 */
@FeignClient(name = "performance-service", configuration = AdminFeignConfig.class)
public interface PerformanceServiceClient {

    @GetMapping("/performance/worker/{workerId}")
    WorkerPerformanceReport getWorkerPerformance(@PathVariable("workerId") Long workerId);
}
