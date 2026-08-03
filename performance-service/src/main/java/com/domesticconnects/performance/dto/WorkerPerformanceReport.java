package com.domesticconnects.performance.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Payload returned by both {@code GET /performance/worker/{workerId}} and
 * {@code GET /performance/worker/{workerId}/history}: the worker's review
 * history (most recent first) together with the average rating and pagination
 * metadata. {@code averageRating} is {@code null} while the worker has no
 * reviews yet.
 * <p>
 * On the non-paginated endpoint {@code page} is always {@code 0} and
 * {@code size}/{@code totalElements} equal the number of reviews (at most one
 * page). On the history endpoint the {@code reviews} list holds only the
 * requested page.
 */
@Data
@Builder
public class WorkerPerformanceReport {

    private Long workerId;
    private long reviewCount;
    private Double averageRating;
    private List<PerformanceReviewResponse> reviews;

    /**
     * Count of reviews per rating, always covering ratings 1-5 in ascending
     * order (zero counts included). Reflects the worker's entire history.
     */
    private List<RatingCount> ratingDistribution;

    /** 0-based index of the returned page. */
    private int page;
    /** Number of reviews in this page. */
    private int size;
    /** Total number of pages for the configured page size. */
    private int totalPages;
    /** Total number of reviews for the worker across all pages. */
    private long totalElements;
}
