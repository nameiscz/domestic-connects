package com.domesticconnects.payroll.client;

import com.domesticconnects.payroll.config.AttendanceFeignConfig;
import com.domesticconnects.payroll.dto.WorkerAttendanceReport;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

/**
 * OpenFeign client for attendance-service.
 * <p>
 * Resolved through Eureka by service name; payroll-service's Feign config adds
 * the {@code X-User-Role} header this endpoint requires.
 */
@FeignClient(name = "attendance-service", configuration = AttendanceFeignConfig.class)
public interface AttendanceServiceClient {

    /**
     * Worker attendance for a given month/year, including the present-days summary.
     */
    @GetMapping("/attendance/worker/{workerId}")
    WorkerAttendanceReport getWorkerAttendance(@PathVariable("workerId") Long workerId,
                                               @RequestParam("month") int month,
                                               @RequestParam("year") int year);

    /**
     * Distinct worker ids with attendance in the given month/year — used to
     * drive batch salary-slip generation.
     */
    @GetMapping("/attendance/workers")
    List<Long> getWorkerIdsWithAttendance(@RequestParam("month") int month,
                                          @RequestParam("year") int year);
}
