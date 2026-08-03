package com.domesticconnects.performance.service;

import com.domesticconnects.performance.dto.PerformanceReviewRequest;
import com.domesticconnects.performance.dto.PerformanceReviewResponse;
import com.domesticconnects.performance.dto.PerformanceReviewUpdateRequest;
import com.domesticconnects.performance.dto.RatingCount;
import com.domesticconnects.performance.dto.WorkerPerformanceReport;
import com.domesticconnects.performance.entity.PerformanceReview;
import com.domesticconnects.performance.exception.ResourceNotFoundException;
import com.domesticconnects.performance.repository.PerformanceReviewRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PerformanceReviewService {

    private static final Logger log = LoggerFactory.getLogger(PerformanceReviewService.class);

    /** Upper bound for the {@code size} pagination parameter. */
    private static final int MAX_PAGE_SIZE = 100;

    private final PerformanceReviewRepository performanceReviewRepository;

    /**
     * Persists a new performance review. The rating is re-validated in the
     * service layer as defence in depth — the DTO already enforces 1-5 via
     * bean validation.
     */
    @Transactional
    public PerformanceReviewResponse submitReview(PerformanceReviewRequest request) {
        validateRating(request.getRating());

        PerformanceReview review = PerformanceReview.builder()
                .workerId(request.getWorkerId())
                .jobId(request.getJobId())
                .rating(request.getRating())
                .remarks(request.getRemarks())
                .reviewedBy(request.getReviewedBy())
                .build();

        review = performanceReviewRepository.save(review);

        log.info("Performance review submitted for worker {} with rating {} by {}",
                review.getWorkerId(), review.getRating(), review.getReviewedBy());
        return toResponse(review);
    }

    /**
     * Updates the mutable fields (rating, remarks) of an existing review.
     * {@code workerId}, {@code jobId} and {@code reviewedBy} are immutable
     * identity/audit fields and are not touched. Concurrent edits to the same
     * review fail with an optimistic-lock conflict (mapped to HTTP 409).
     */
    @Transactional
    public PerformanceReviewResponse updateReview(Long id, PerformanceReviewUpdateRequest request) {
        validateRating(request.getRating());

        PerformanceReview review = performanceReviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "PerformanceReview", "id", id));

        review.setRating(request.getRating());
        review.setRemarks(request.getRemarks());
        // Flush immediately so @PreUpdate stamps updatedAt before the response is built.
        review = performanceReviewRepository.saveAndFlush(review);

        log.info("Performance review {} updated to rating {} by {}",
                review.getId(), review.getRating(), review.getReviewedBy());
        return toResponse(review);
    }

    /**
     * Permanently deletes a review. Reviews are immutable history records with
     * no status field, so a hard delete is used (restricted to admins).
     */
    @Transactional
    public void deleteReview(Long id) {
        if (!performanceReviewRepository.existsById(id)) {
            throw new ResourceNotFoundException("PerformanceReview", "id", id);
        }
        performanceReviewRepository.deleteById(id);
        log.info("Performance review {} deleted", id);
    }

    /**
     * Returns a worker's full review history (most recent first) together with
     * the average rating rounded to two decimal places. The average is
     * {@code null} when the worker has no reviews yet. Reported as a single
     * page (page 0) so the payload shape matches the paginated history
     * endpoint.
     */
    @Transactional(readOnly = true)
    public WorkerPerformanceReport getWorkerPerformance(Long workerId) {
        List<PerformanceReview> reviews =
                performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(workerId);

        Double averageRating =
                performanceReviewRepository.findAverageRatingByWorkerId(workerId);

        return WorkerPerformanceReport.builder()
                .workerId(workerId)
                .reviewCount(reviews.size())
                .averageRating(roundToTwoDecimals(averageRating))
                .reviews(reviews.stream()
                        .map(this::toResponse)
                        .collect(Collectors.toList()))
                .ratingDistribution(buildRatingDistribution(workerId))
                .page(0)
                .size(reviews.size())
                .totalPages(reviews.isEmpty() ? 0 : 1)
                .totalElements(reviews.size())
                .build();
    }

    /**
     * Returns a paginated slice of a worker's review history (most recent
     * first) together with the overall average rating and pagination metadata.
     * {@code page} is 0-based; {@code size} must be between 1 and 100.
     */
    @Transactional(readOnly = true)
    public WorkerPerformanceReport getWorkerHistory(Long workerId, int page, int size) {
        validatePagination(page, size);

        Page<PerformanceReview> pageResult = performanceReviewRepository
                .findByWorkerIdOrderByCreatedAtDesc(workerId, PageRequest.of(page, size));

        Double averageRating =
                performanceReviewRepository.findAverageRatingByWorkerId(workerId);

        return WorkerPerformanceReport.builder()
                .workerId(workerId)
                .reviewCount(pageResult.getTotalElements())
                .averageRating(roundToTwoDecimals(averageRating))
                .reviews(pageResult.getContent().stream()
                        .map(this::toResponse)
                        .collect(Collectors.toList()))
                .ratingDistribution(buildRatingDistribution(workerId))
                .page(page)
                .size(pageResult.getNumberOfElements())
                .totalPages(pageResult.getTotalPages())
                .totalElements(pageResult.getTotalElements())
                .build();
    }

    private void validateRating(Integer rating) {
        if (rating == null || rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }
    }

    /**
     * Builds the worker's rating histogram. Always contains all five buckets
     * (1-5) in ascending order, including zero counts, so clients can render
     * a complete chart without inferring missing ratings.
     */
    private List<RatingCount> buildRatingDistribution(Long workerId) {
        Map<Integer, Long> counts = new TreeMap<>();
        for (int rating = 1; rating <= 5; rating++) {
            counts.put(rating, 0L);
        }
        for (RatingCount row : performanceReviewRepository.findRatingCountsByWorkerId(workerId)) {
            counts.put(row.getRating(), row.getCount());
        }
        return counts.entrySet().stream()
                .map(e -> RatingCount.builder()
                        .rating(e.getKey())
                        .count(e.getValue())
                        .build())
                .collect(Collectors.toList());
    }

    private void validatePagination(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("Page must be 0 or greater");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException(
                    "Size must be between 1 and " + MAX_PAGE_SIZE);
        }
    }

    private Double roundToTwoDecimals(Double average) {
        if (average == null) {
            return null;
        }
        return Math.round(average * 100.0) / 100.0;
    }

    private PerformanceReviewResponse toResponse(PerformanceReview review) {
        return PerformanceReviewResponse.builder()
                .id(review.getId())
                .workerId(review.getWorkerId())
                .jobId(review.getJobId())
                .rating(review.getRating())
                .remarks(review.getRemarks())
                .reviewedBy(review.getReviewedBy())
                .createdAt(review.getCreatedAt())
                .updatedAt(review.getUpdatedAt())
                .build();
    }
}
