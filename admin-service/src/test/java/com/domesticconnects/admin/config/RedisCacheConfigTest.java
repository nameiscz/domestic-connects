package com.domesticconnects.admin.config;

import com.domesticconnects.admin.dto.DashboardSummary;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the configured Redis JSON serializer round-trips the cached
 * dashboard summary — the part of the caching setup that can only fail at
 * runtime (default typing plus {@code LocalDateTime} and nullable
 * {@code Double} handling). No Redis server is required; the production
 * serializer bean is exercised directly.
 */
@DisplayName("RedisCacheConfig serializer")
class RedisCacheConfigTest {

    private final GenericJackson2JsonRedisSerializer serializer =
            new RedisCacheConfig().redisValueSerializer();

    @Test
    @DisplayName("a DashboardSummary round-trips through the configured serializer")
    void dashboardSummaryRoundTrips() {
        DashboardSummary original = DashboardSummary.builder()
                .totalUsers(4)
                .activeUsers(3)
                .totalJobs(10)
                .activeJobs(6)
                .inactiveJobs(4)
                .monthlyAttendanceRate(53.33)
                .averagePerformanceRating(3.5)
                .generatedAt(LocalDateTime.of(2026, 8, 4, 9, 15, 0))
                .build();

        DashboardSummary restored =
                (DashboardSummary) serializer.deserialize(serializer.serialize(original));

        assertThat(restored).isEqualTo(original);
    }

    @Test
    @DisplayName("nullable metrics survive the round-trip")
    void nullableMetricsSurvive() {
        DashboardSummary original = DashboardSummary.builder()
                .totalUsers(0)
                .activeUsers(0)
                .totalJobs(0)
                .activeJobs(0)
                .inactiveJobs(0)
                .monthlyAttendanceRate(null)
                .averagePerformanceRating(null)
                .generatedAt(LocalDateTime.of(2026, 8, 4, 9, 15, 0))
                .build();

        DashboardSummary restored =
                (DashboardSummary) serializer.deserialize(serializer.serialize(original));

        assertThat(restored).isEqualTo(original);
        assertThat(restored.getMonthlyAttendanceRate()).isNull();
        assertThat(restored.getAveragePerformanceRating()).isNull();
    }
}
