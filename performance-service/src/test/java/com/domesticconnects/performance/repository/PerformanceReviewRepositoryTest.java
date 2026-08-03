package com.domesticconnects.performance.repository;

import com.domesticconnects.performance.dto.RatingCount;
import com.domesticconnects.performance.entity.PerformanceReview;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@DisplayName("PerformanceReviewRepository")
class PerformanceReviewRepositoryTest {

    @Autowired
    private PerformanceReviewRepository performanceReviewRepository;

    @Autowired
    private EntityManager entityManager;

    private PerformanceReview createReview(Long workerId, Integer rating, String reviewedBy) {
        return PerformanceReview.builder()
                .workerId(workerId)
                .jobId(1L)
                .rating(rating)
                .remarks("Remarks for worker " + workerId)
                .reviewedBy(reviewedBy)
                .build();
    }

    @Test
    @DisplayName("findByWorkerIdOrderByCreatedAtDesc should return only the worker's reviews")
    void findByWorkerIdOrderByCreatedAtDesc_filtersByWorker() {
        performanceReviewRepository.saveAndFlush(createReview(10L, 4, "employer@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(10L, 5, "admin@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(11L, 3, "employer@example.com"));

        List<PerformanceReview> result =
                performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(10L);

        assertThat(result).hasSize(2);
        assertThat(result).allMatch(r -> r.getWorkerId().equals(10L));
    }

    @Test
    @DisplayName("findAverageRatingByWorkerId should return the mean of the worker's ratings")
    void findAverageRatingByWorkerId_computesAverage() {
        performanceReviewRepository.saveAndFlush(createReview(10L, 4, "employer@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(10L, 5, "admin@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(11L, 1, "employer@example.com"));

        Double average = performanceReviewRepository.findAverageRatingByWorkerId(10L);

        assertThat(average).isEqualTo(4.5);
    }

    @Test
    @DisplayName("findAverageRatingByWorkerId should return null when the worker has no reviews")
    void findAverageRatingByWorkerId_returnsNullForUnknownWorker() {
        Double average = performanceReviewRepository.findAverageRatingByWorkerId(99L);

        assertThat(average).isNull();
    }

    @Test
    @DisplayName("findRatingCountsByWorkerId should group counts per rating for the worker")
    void findRatingCountsByWorkerId_groupsByRating() {
        performanceReviewRepository.saveAndFlush(createReview(10L, 5, "employer@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(10L, 5, "admin@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(10L, 4, "employer@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(11L, 1, "employer@example.com"));

        List<RatingCount> counts = performanceReviewRepository.findRatingCountsByWorkerId(10L);

        Map<Integer, Long> byRating = counts.stream().collect(Collectors.toMap(
                RatingCount::getRating, RatingCount::getCount));
        assertThat(byRating).containsEntry(4, 1L).containsEntry(5, 2L);
        assertThat(byRating).doesNotContainKey(1);
        assertThat(counts).allMatch(c -> c.getCount() >= 0);
    }

    @Test
    @DisplayName("findRatingCountsByWorkerId should return an empty list for an unknown worker")
    void findRatingCountsByWorkerId_returnsEmptyForUnknownWorker() {
        List<RatingCount> counts = performanceReviewRepository.findRatingCountsByWorkerId(99L);

        assertThat(counts).isEmpty();
    }

    @Test
    @DisplayName("database check constraint should reject a rating outside 1-5")
    void ratingCheckConstraint_rejectsOutOfRangeRating() {
        assertThatThrownBy(() ->
                performanceReviewRepository.saveAndFlush(createReview(10L, 9, "employer@example.com")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("stale update should be rejected by optimistic locking")
    void staleUpdate_isRejectedByOptimisticLock() {
        PerformanceReview saved = performanceReviewRepository
                .saveAndFlush(createReview(10L, 4, "employer@example.com"));

        // Simulate a concurrent modification committing after we loaded the entity.
        entityManager.clear();
        PerformanceReview fresh = performanceReviewRepository
                .findById(saved.getId()).orElseThrow();
        fresh.setRating(5);
        performanceReviewRepository.saveAndFlush(fresh);

        // Now write back our stale snapshot (still holding the old version).
        entityManager.clear();
        saved.setRating(2);
        assertThatThrownBy(() -> performanceReviewRepository.saveAndFlush(saved))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
    }

    @Test
    @DisplayName("paged query should return a slice and the total element count")
    void findByWorkerIdOrderByCreatedAtDesc_paginates() {
        performanceReviewRepository.saveAndFlush(createReview(10L, 4, "employer@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(10L, 5, "admin@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(10L, 3, "employer@example.com"));
        performanceReviewRepository.saveAndFlush(createReview(11L, 2, "employer@example.com"));

        Page<PerformanceReview> firstPage = performanceReviewRepository
                .findByWorkerIdOrderByCreatedAtDesc(10L, PageRequest.of(0, 2));

        assertThat(firstPage.getTotalElements()).isEqualTo(3);
        assertThat(firstPage.getTotalPages()).isEqualTo(2);
        assertThat(firstPage.getContent()).hasSize(2);
        assertThat(firstPage.getContent())
                .allMatch(r -> r.getWorkerId().equals(10L));
    }
}
