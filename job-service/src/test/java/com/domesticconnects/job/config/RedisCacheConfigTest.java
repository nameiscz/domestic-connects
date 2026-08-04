package com.domesticconnects.job.config;

import com.domesticconnects.job.dto.JobPostResponse;
import com.domesticconnects.job.entity.JobStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the configured Redis JSON serializer round-trips the cached DTOs —
 * the part of the caching setup that can only fail at runtime (default typing
 * plus {@code LocalDateTime} / {@code BigDecimal} / enum handling). No Redis
 * server is required; the production serializer bean is exercised directly.
 */
@DisplayName("RedisCacheConfig serializer")
class RedisCacheConfigTest {

    private final GenericJackson2JsonRedisSerializer serializer =
            new RedisCacheConfig().redisValueSerializer();

    private JobPostResponse sample() {
        return JobPostResponse.builder()
                .id(7L)
                .title("Plumbing repair")
                .description("Fix leaking sink")
                .employerId(3L)
                .wagePerDay(new BigDecimal("500.00"))
                .location("Hyderabad")
                .status(JobStatus.ASSIGNED)
                .createdAt(LocalDateTime.of(2026, 8, 4, 10, 30, 15))
                .build();
    }

    @Test
    @DisplayName("a single JobPostResponse round-trips through the configured serializer")
    void singleJobPostRoundTrips() {
        JobPostResponse original = sample();

        JobPostResponse restored =
                (JobPostResponse) serializer.deserialize(serializer.serialize(original));

        assertThat(restored).isNotNull();
        assertThat(restored.getId()).isEqualTo(original.getId());
        assertThat(restored.getTitle()).isEqualTo(original.getTitle());
        assertThat(restored.getDescription()).isEqualTo(original.getDescription());
        assertThat(restored.getEmployerId()).isEqualTo(original.getEmployerId());
        assertThat(restored.getWagePerDay()).isEqualByComparingTo(original.getWagePerDay());
        assertThat(restored.getLocation()).isEqualTo(original.getLocation());
        assertThat(restored.getStatus()).isEqualTo(original.getStatus());
        assertThat(restored.getCreatedAt()).isEqualTo(original.getCreatedAt());
    }

    @Test
    @DisplayName("a List<JobPostResponse> round-trips with concrete element types")
    void jobPostListRoundTrips() {
        // Mirror the service: getAllJobPosts() returns an ArrayList via Collectors.toList().
        List<JobPostResponse> original = new ArrayList<>(List.of(sample()));

        Object restored = serializer.deserialize(serializer.serialize(original));

        assertThat(restored).isInstanceOf(List.class);
        List<?> restoredList = (List<?>) restored;
        assertThat(restoredList).hasSize(1);
        assertThat(restoredList.get(0)).isInstanceOf(JobPostResponse.class);
        JobPostResponse restoredPost = (JobPostResponse) restoredList.get(0);
        assertThat(restoredPost.getTitle()).isEqualTo("Plumbing repair");
        assertThat(restoredPost.getStatus()).isEqualTo(JobStatus.ASSIGNED);
        assertThat(restoredPost.getWagePerDay()).isEqualByComparingTo(new BigDecimal("500.00"));
    }
}
