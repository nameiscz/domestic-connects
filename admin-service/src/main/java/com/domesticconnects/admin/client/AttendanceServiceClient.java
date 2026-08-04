package com.domesticconnects.admin.client;

import com.domesticconnects.admin.config.AdminFeignConfig;
import com.domesticconnects.admin.dto.WorkerAttendanceReport;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

/**
 * OpenFeign client for attendance-service. Used to aggregate the current
 * month's attendance rate across all workers.
 */
@FeignClient(name = "attendance-service", configuration = AdminFeignConfig.class)
public interface AttendanceServiceClient {

    /**
     * Distinct worker ids with attendance in the given month/year.
     */
    @GetMapping("/attendance/workers")
    List<Long> getWorkerIdsWithAttendance(@RequestParam("month") int month,
                                          @RequestParam("year") int year);

    /**
     * Per-worker attendance for the month/year, including the present-days summary.
     */
    @GetMapping("/attendance/worker/{workerId}")
    WorkerAttendanceReport getWorkerAttendance(@PathVariable("workerId") Long workerId,
                                               @RequestParam("month") int month,
                                               @RequestParam("year") int year);
}
