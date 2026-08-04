package com.domesticconnects.admin.service;

import com.domesticconnects.admin.dto.AttendanceSummary;
import com.domesticconnects.admin.dto.DashboardAnalytics;
import com.domesticconnects.admin.dto.DashboardSummary;
import com.domesticconnects.admin.dto.JobPostResponse;
import com.domesticconnects.admin.dto.JobStatus;
import com.domesticconnects.admin.dto.UserInfo;
import com.domesticconnects.admin.dto.UserRole;
import com.domesticconnects.admin.dto.WorkerAttendanceReport;
import com.domesticconnects.admin.dto.WorkerPerformanceReport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Aggregates dashboard data from the four downstream services. The actual
 * downstream calls live in {@link DownstreamService}, which applies the
 * Resilience4j circuit breakers and fallbacks; this class only orchestrates
 * and computes metrics, skipping any {@code null} / empty fallback results.
 * <p>
 * Attendance rate for the current month is defined as
 * {@code (presentDays + 0.5 * halfDays) / totalDays * 100} aggregated across
 * all workers that have attendance that month. Average performance rating is
 * the mean of the workers' individual averages (workers without any review
 * are ignored).
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final DownstreamService downstreamService;

    // ------------------------------------------------------------------
    // Public dashboard endpoints
    // ------------------------------------------------------------------

    public DashboardSummary getDashboardSummary() {
        List<UserInfo> users = getUsers();
        List<JobPostResponse> jobs = getJobs();
        long activeJobs = countActiveJobs(jobs);

        return DashboardSummary.builder()
                .totalUsers(users.size())
                .activeUsers(users.stream().filter(UserInfo::isActive).count())
                .totalJobs(jobs.size())
                .activeJobs(activeJobs)
                .inactiveJobs(jobs.size() - activeJobs)
                .monthlyAttendanceRate(computeMonthlyAttendanceRate())
                .averagePerformanceRating(computeAveragePerformanceRating(users))
                .generatedAt(LocalDateTime.now())
                .build();
    }

    public List<UserInfo> getUsers() {
        List<UserInfo> users = downstreamService.fetchUsers().getData();
        return users == null ? List.of() : users;
    }

    public List<JobPostResponse> getJobs() {
        return downstreamService.fetchJobs();
    }

    public DashboardAnalytics getDashboardAnalytics() {
        List<UserInfo> users = getUsers();
        List<JobPostResponse> jobs = getJobs();
        long activeJobs = countActiveJobs(jobs);

        return DashboardAnalytics.builder()
                .usersByRole(users.stream().collect(
                        Collectors.groupingBy(user -> String.valueOf(user.getRole()), Collectors.counting())))
                .jobsByStatus(jobs.stream().collect(
                        Collectors.groupingBy(job -> String.valueOf(job.getStatus()), Collectors.counting())))
                .activeJobs(activeJobs)
                .inactiveJobs(jobs.size() - activeJobs)
                .monthlyAttendanceRate(computeMonthlyAttendanceRate())
                .averagePerformanceRating(computeAveragePerformanceRating(users))
                .build();
    }

    // ------------------------------------------------------------------
    // Metric computation
    // ------------------------------------------------------------------

    /**
     * Current-month attendance rate across all workers, as a percentage (0-100)
     * rounded to two decimal places. {@code null} when no attendance data exists.
     */
    private Double computeMonthlyAttendanceRate() {
        YearMonth now = YearMonth.now();
        int month = now.getMonthValue();
        int year = now.getYear();

        List<Long> workerIds = downstreamService.fetchWorkerIds(month, year);
        // Fractional accumulation: a half day counts as 0.5 present units. The
        // per-worker value is kept as a double and rounded only once at the end
        // so small populations (e.g. a single half-day) are not over-credited.
        double presentUnits = 0;
        long totalDays = 0;

        for (Long workerId : workerIds) {
            WorkerAttendanceReport report = downstreamService.fetchWorkerAttendance(workerId, month, year);
            if (report == null || report.getSummary() == null) {
                continue;
            }
            AttendanceSummary summary = report.getSummary();
            presentUnits += summary.getPresentDays() + summary.getHalfDays() * 0.5;
            totalDays += summary.getTotalDays();
        }

        if (totalDays == 0) {
            return null;
        }
        return Math.round((presentUnits / totalDays) * 10000.0) / 100.0;
    }

    /**
     * Average performance rating across all workers (1-5), rounded to two
     * decimal places. {@code null} when no worker has a rating yet. The user
     * list is passed in (already fetched for the summary) to avoid a second
     * auth-service round trip.
     */
    private Double computeAveragePerformanceRating(List<UserInfo> users) {
        List<Long> workerIds = users.stream()
                .filter(user -> user.getRole() == UserRole.WORKER)
                .map(UserInfo::getId)
                .toList();

        double ratingSum = 0;
        int ratedWorkers = 0;

        for (Long workerId : workerIds) {
            WorkerPerformanceReport report = downstreamService.fetchWorkerPerformance(workerId);
            if (report == null || report.getAverageRating() == null) {
                continue;
            }
            ratingSum += report.getAverageRating();
            ratedWorkers++;
        }

        if (ratedWorkers == 0) {
            return null;
        }
        return Math.round((ratingSum / ratedWorkers) * 100.0) / 100.0;
    }

    /**
     * A job post counts as active while it is {@link JobStatus#OPEN} or
     * {@link JobStatus#ASSIGNED}; {@link JobStatus#CLOSED} is inactive.
     */
    private long countActiveJobs(List<JobPostResponse> jobs) {
        return jobs.stream()
                .filter(job -> job.getStatus() == JobStatus.OPEN
                        || job.getStatus() == JobStatus.ASSIGNED)
                .count();
    }
}
