package com.domesticconnects.admin.service;

import com.domesticconnects.admin.client.AttendanceServiceClient;
import com.domesticconnects.admin.client.AuthServiceClient;
import com.domesticconnects.admin.client.JobServiceClient;
import com.domesticconnects.admin.client.PerformanceServiceClient;
import com.domesticconnects.admin.dto.ApiResponse;
import com.domesticconnects.admin.dto.JobPostResponse;
import com.domesticconnects.admin.dto.UserInfo;
import com.domesticconnects.admin.dto.WorkerAttendanceReport;
import com.domesticconnects.admin.dto.WorkerPerformanceReport;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Thin wrapper around the four Feign clients that adds a Resilience4j
 * {@link CircuitBreaker} — with a fallback method in this class — around every
 * downstream call.
 * <p>
 * This must be a <b>separate Spring bean</b> from {@link AdminService}: the
 * circuit-breaker aspect is applied through the Spring AOP proxy, so calls to
 * these guarded methods have to come from another bean. Guarded methods called
 * internally on the same object would silently bypass the breaker.
 * <p>
 * Every fallback returns a safe default (empty list / {@code null}) so one
 * unhealthy service degrades the dashboard instead of failing it.
 */
@Component
@RequiredArgsConstructor
public class DownstreamService {

    private static final Logger log = LoggerFactory.getLogger(DownstreamService.class);

    private final AuthServiceClient authServiceClient;
    private final JobServiceClient jobServiceClient;
    private final AttendanceServiceClient attendanceServiceClient;
    private final PerformanceServiceClient performanceServiceClient;

    @CircuitBreaker(name = "authService", fallbackMethod = "fetchUsersFallback")
    public ApiResponse<List<UserInfo>> fetchUsers() {
        return authServiceClient.getAllUsers();
    }

    private ApiResponse<List<UserInfo>> fetchUsersFallback(Throwable t) {
        log.warn("auth-service unavailable ({}), falling back to empty user list", t.getMessage());
        return ApiResponse.success("Users temporarily unavailable", List.of());
    }

    @CircuitBreaker(name = "jobService", fallbackMethod = "fetchJobsFallback")
    public List<JobPostResponse> fetchJobs() {
        return jobServiceClient.getAllJobPosts();
    }

    private List<JobPostResponse> fetchJobsFallback(Throwable t) {
        log.warn("job-service unavailable ({}), falling back to empty job list", t.getMessage());
        return List.of();
    }

    @CircuitBreaker(name = "attendanceService", fallbackMethod = "fetchWorkerIdsFallback")
    public List<Long> fetchWorkerIds(int month, int year) {
        return attendanceServiceClient.getWorkerIdsWithAttendance(month, year);
    }

    private List<Long> fetchWorkerIdsFallback(int month, int year, Throwable t) {
        log.warn("attendance-service unavailable ({}), falling back to empty worker-id list", t.getMessage());
        return List.of();
    }

    @CircuitBreaker(name = "attendanceService", fallbackMethod = "fetchWorkerAttendanceFallback")
    public WorkerAttendanceReport fetchWorkerAttendance(Long workerId, int month, int year) {
        return attendanceServiceClient.getWorkerAttendance(workerId, month, year);
    }

    private WorkerAttendanceReport fetchWorkerAttendanceFallback(Long workerId, int month, int year, Throwable t) {
        log.warn("attendance-service unavailable for worker {} ({}), skipping in aggregation",
                workerId, t.getMessage());
        return null;
    }

    @CircuitBreaker(name = "performanceService", fallbackMethod = "fetchWorkerPerformanceFallback")
    public WorkerPerformanceReport fetchWorkerPerformance(Long workerId) {
        return performanceServiceClient.getWorkerPerformance(workerId);
    }

    private WorkerPerformanceReport fetchWorkerPerformanceFallback(Long workerId, Throwable t) {
        log.warn("performance-service unavailable for worker {} ({}), skipping in aggregation",
                workerId, t.getMessage());
        return null;
    }
}
