package com.domesticconnects.admin.service;

import com.domesticconnects.admin.client.AttendanceServiceClient;
import com.domesticconnects.admin.client.AuthServiceClient;
import com.domesticconnects.admin.client.JobServiceClient;
import com.domesticconnects.admin.client.PerformanceServiceClient;
import com.domesticconnects.admin.dto.ApiResponse;
import com.domesticconnects.admin.dto.AttendanceSummary;
import com.domesticconnects.admin.dto.DashboardAnalytics;
import com.domesticconnects.admin.dto.DashboardSummary;
import com.domesticconnects.admin.dto.JobPostResponse;
import com.domesticconnects.admin.dto.JobStatus;
import com.domesticconnects.admin.dto.UserInfo;
import com.domesticconnects.admin.dto.UserRole;
import com.domesticconnects.admin.dto.WorkerAttendanceReport;
import com.domesticconnects.admin.dto.WorkerPerformanceReport;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

/**
 * Verifies dashboard aggregation and that every downstream failure degrades
 * to the circuit-breaker fallback instead of propagating. The four Feign
 * clients are mocked; the Resilience4j aspects remain active so fallback
 * behaviour is exercised for real.
 */
@SpringBootTest
@ActiveProfiles("test")
class AdminServiceTest {

    @Autowired
    private AdminService adminService;

    @Autowired
    private CircuitBreakerRegistry circuitBreakerRegistry;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthServiceClient authServiceClient;

    @MockBean
    private JobServiceClient jobServiceClient;

    @MockBean
    private AttendanceServiceClient attendanceServiceClient;

    @MockBean
    private PerformanceServiceClient performanceServiceClient;

    @BeforeEach
    void setUp() {
        reset(authServiceClient, jobServiceClient, attendanceServiceClient, performanceServiceClient);
        circuitBreakerRegistry.getAllCircuitBreakers().forEach(CircuitBreaker::reset);
    }

    // ------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------

    private List<UserInfo> sampleUsers() {
        return List.of(
                UserInfo.builder().id(1L).name("Admin").email("admin@test.com")
                        .role(UserRole.ADMIN).isActive(true).build(),
                UserInfo.builder().id(2L).name("Alice").email("alice@test.com")
                        .role(UserRole.WORKER).isActive(true).build(),
                UserInfo.builder().id(3L).name("Bob").email("bob@test.com")
                        .role(UserRole.WORKER).isActive(false).build(),
                UserInfo.builder().id(4L).name("Erin").email("erin@test.com")
                        .role(UserRole.EMPLOYER).isActive(true).build());
    }

    private List<JobPostResponse> sampleJobs() {
        return List.of(
                JobPostResponse.builder().id(1L).title("Cook").status(JobStatus.OPEN).build(),
                JobPostResponse.builder().id(2L).title("Nanny").status(JobStatus.ASSIGNED).build(),
                JobPostResponse.builder().id(3L).title("Driver").status(JobStatus.CLOSED).build(),
                JobPostResponse.builder().id(4L).title("Maid").status(JobStatus.CLOSED).build());
    }

    private WorkerAttendanceReport report(Long workerId, long present, long half, long total) {
        return WorkerAttendanceReport.builder()
                .workerId(workerId)
                .summary(AttendanceSummary.builder()
                        .workerId(workerId).month(1).year(2026)
                        .presentDays(present).halfDays(half).totalDays(total)
                        .build())
                .build();
    }

    private void mockHappyPathDownstreams() {
        when(authServiceClient.getAllUsers())
                .thenReturn(ApiResponse.success("ok", sampleUsers()));
        when(jobServiceClient.getAllJobPosts()).thenReturn(sampleJobs());
        when(attendanceServiceClient.getWorkerIdsWithAttendance(anyInt(), anyInt()))
                .thenReturn(List.of(2L, 3L));
        when(attendanceServiceClient.getWorkerAttendance(anyLong(), anyInt(), anyInt()))
                .thenReturn(report(2L, 10, 2, 20), report(3L, 5, 0, 10));
        when(performanceServiceClient.getWorkerPerformance(anyLong()))
                .thenReturn(WorkerPerformanceReport.builder().workerId(2L).averageRating(4.0).reviewCount(3).build(),
                        WorkerPerformanceReport.builder().workerId(3L).averageRating(3.0).reviewCount(5).build());
    }

    private static FeignException feignError(String message) {
        Map<String, Collection<String>> headers = Map.of();
        feign.Request request = feign.Request.create(
                feign.Request.HttpMethod.GET, "http://downstream/endpoint",
                headers, null, StandardCharsets.UTF_8);
        return new feign.FeignException.BadRequest(message, request, new byte[0], headers);
    }

    // ------------------------------------------------------------------
    // Aggregation
    // ------------------------------------------------------------------

    @Test
    @DisplayName("summary computes counts, monthly attendance rate and average rating")
    void summaryComputesMetrics() {
        mockHappyPathDownstreams();

        DashboardSummary summary = adminService.getDashboardSummary();

        assertThat(summary.getTotalUsers()).isEqualTo(4);
        assertThat(summary.getActiveUsers()).isEqualTo(3);
        assertThat(summary.getTotalJobs()).isEqualTo(4);
        assertThat(summary.getActiveJobs()).isEqualTo(2);
        assertThat(summary.getInactiveJobs()).isEqualTo(2);
        // (10 + 0.5*2 + 5 + 0.5*0) / (20 + 10) * 100 = 16/30 = 53.33%
        assertThat(summary.getMonthlyAttendanceRate()).isEqualTo(53.33);
        // (4.0 + 3.0) / 2
        assertThat(summary.getAveragePerformanceRating()).isEqualTo(3.5);
        // 3 + 5 reviews across the two workers
        assertThat(summary.getTotalReviews()).isEqualTo(8);
        assertThat(summary.getGeneratedAt()).isNotNull();
    }

    @Test
    @DisplayName("analytics groups users by role and jobs by status")
    void analyticsGroupsByRoleAndStatus() {
        mockHappyPathDownstreams();

        DashboardAnalytics analytics = adminService.getDashboardAnalytics();

        assertThat(analytics.getUsersByRole())
                .containsEntry("ADMIN", 1L)
                .containsEntry("WORKER", 2L)
                .containsEntry("EMPLOYER", 1L);
        assertThat(analytics.getJobsByStatus())
                .containsEntry("OPEN", 1L)
                .containsEntry("ASSIGNED", 1L)
                .containsEntry("CLOSED", 2L);
        assertThat(analytics.getActiveJobs()).isEqualTo(2);
        assertThat(analytics.getInactiveJobs()).isEqualTo(2);
        // Same aggregation as the summary: 3 + 5 reviews.
        assertThat(analytics.getTotalReviews()).isEqualTo(8);
    }

    @Test
    @DisplayName("users endpoint returns the user list")
    void getUsersReturnsList() {
        when(authServiceClient.getAllUsers())
                .thenReturn(ApiResponse.success("ok", sampleUsers()));

        assertThat(adminService.getUsers()).hasSize(4);
    }

    @Test
    @DisplayName("jobs endpoint returns the job list")
    void getJobsReturnsList() {
        when(jobServiceClient.getAllJobPosts()).thenReturn(sampleJobs());

        assertThat(adminService.getJobs()).hasSize(4);
    }

    @Test
    @DisplayName("UserInfo deserializes the JSON shape produced by auth-service")
    void userInfoDeserializesAuthJsonShape() throws Exception {
        // auth-service serializes isActive as "active" (JavaBeans name from
        // the Lombok isXxx() getter).
        String json = """
                {"id":2,"name":"Alice","email":"alice@test.com","role":"WORKER","active":false}
                """;

        UserInfo user = objectMapper.readValue(json, UserInfo.class);

        assertThat(user.getId()).isEqualTo(2L);
        assertThat(user.getName()).isEqualTo("Alice");
        assertThat(user.getRole()).isEqualTo(UserRole.WORKER);
        assertThat(user.isActive()).isFalse();
    }

    // ------------------------------------------------------------------
    // Circuit-breaker fallbacks
    // ------------------------------------------------------------------

    @Test
    @DisplayName("users fall back to an empty list when auth-service is down")
    void usersFallbackWhenAuthServiceDown() {
        when(authServiceClient.getAllUsers()).thenThrow(feignError("auth-service down"));

        assertThat(adminService.getUsers()).isEmpty();
    }

    @Test
    @DisplayName("jobs fall back to an empty list when job-service is down")
    void jobsFallbackWhenJobServiceDown() {
        when(jobServiceClient.getAllJobPosts()).thenThrow(feignError("job-service down"));

        assertThat(adminService.getJobs()).isEmpty();
    }

    @Test
    @DisplayName("summary still computes when attendance-service is down (rate null)")
    void summaryToleratesAttendanceDown() {
        when(authServiceClient.getAllUsers())
                .thenReturn(ApiResponse.success("ok", sampleUsers()));
        when(jobServiceClient.getAllJobPosts()).thenReturn(sampleJobs());
        when(attendanceServiceClient.getWorkerIdsWithAttendance(anyInt(), anyInt()))
                .thenThrow(feignError("attendance-service down"));

        DashboardSummary summary = adminService.getDashboardSummary();

        assertThat(summary.getMonthlyAttendanceRate()).isNull();
        // Other metrics still computed from healthy services.
        assertThat(summary.getTotalUsers()).isEqualTo(4);
        assertThat(summary.getTotalJobs()).isEqualTo(4);
    }

    @Test
    @DisplayName("a single failing worker's attendance is skipped, others still counted")
    void attendanceSkipsFailingWorker() {
        when(authServiceClient.getAllUsers())
                .thenReturn(ApiResponse.success("ok", sampleUsers()));
        when(jobServiceClient.getAllJobPosts()).thenReturn(sampleJobs());
        when(attendanceServiceClient.getWorkerIdsWithAttendance(anyInt(), anyInt()))
                .thenReturn(List.of(2L, 3L));
        when(attendanceServiceClient.getWorkerAttendance(anyLong(), anyInt(), anyInt()))
                .thenThrow(feignError("worker report failed"))
                .thenReturn(report(3L, 5, 0, 10));
        when(performanceServiceClient.getWorkerPerformance(anyLong()))
                .thenReturn(WorkerPerformanceReport.builder().workerId(2L).averageRating(4.0).build(),
                        WorkerPerformanceReport.builder().workerId(3L).averageRating(3.0).build());

        DashboardSummary summary = adminService.getDashboardSummary();

        // Only worker 3 contributed: 5/10 = 50%.
        assertThat(summary.getMonthlyAttendanceRate()).isEqualTo(50.0);
    }

    @Test
    @DisplayName("average rating is null when no worker has reviews")
    void averageRatingNullWhenNoReviews() {
        when(authServiceClient.getAllUsers())
                .thenReturn(ApiResponse.success("ok", sampleUsers()));
        when(jobServiceClient.getAllJobPosts()).thenReturn(sampleJobs());
        when(attendanceServiceClient.getWorkerIdsWithAttendance(anyInt(), anyInt()))
                .thenReturn(List.of());
        // Worker 2 has no rating yet, worker 3 is skipped because performance-service is down.
        when(performanceServiceClient.getWorkerPerformance(2L))
                .thenReturn(WorkerPerformanceReport.builder().workerId(2L).averageRating(null).reviewCount(2).build());
        when(performanceServiceClient.getWorkerPerformance(3L))
                .thenThrow(feignError("performance-service down"));

        DashboardSummary summary = adminService.getDashboardSummary();

        assertThat(summary.getAveragePerformanceRating()).isNull();
        // Reviews from the reachable worker still count even without a rating.
        assertThat(summary.getTotalReviews()).isEqualTo(2);
    }
}
