package com.domesticconnects.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Mirror of {@code com.domesticconnects.performance.dto.WorkerPerformanceReport} —
 * carries the worker's average rating used in dashboard analytics.
 */
@Data
@Builder
public class WorkerPerformanceReport {

    private Long workerId;
    private long reviewCount;
    private Double averageRating;
    private List<PerformanceReviewResponse> reviews;
    private List<RatingCount> ratingDistribution;
    private int page;
    private int size;
    private int totalPages;
    private long totalElements;
}
