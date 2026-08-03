package com.domesticconnects.performance.service;

import com.domesticconnects.performance.dto.PerformanceReviewRequest;
import com.domesticconnects.performance.dto.PerformanceReviewResponse;
import com.domesticconnects.performance.dto.PerformanceReviewUpdateRequest;
import com.domesticconnects.performance.dto.RatingCount;
import com.domesticconnects.performance.dto.WorkerPerformanceReport;
import com.domesticconnects.performance.entity.PerformanceReview;
import com.domesticconnects.performance.exception.ResourceNotFoundException;
import com.domesticconnects.performance.repository.PerformanceReviewRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PerformanceReviewService")
class PerformanceReviewServiceTest {

    @Mock
    private PerformanceReviewRepository performanceReviewRepository;

    @InjectMocks
    private PerformanceReviewService performanceReviewService;

    private PerformanceReviewRequest request(Integer rating, String reviewedBy) {
        PerformanceReviewRequest request = new PerformanceReviewRequest();
        request.setWorkerId(10L);
        request.setJobId(1L);
        request.setRating(rating);
        request.setRemarks("Great work");
        request.setReviewedBy(reviewedBy);
        return request;
    }

    @Test
    @DisplayName("submitReview should save and return the created review")
    void submitReview_savesAndReturnsReview() {
        when(performanceReviewRepository.save(any(PerformanceReview.class)))
                .thenAnswer(invocation -> {
                    PerformanceReview saved = invocation.getArgument(0);
                    saved.setId(1L);
                    saved.setCreatedAt(LocalDateTime.of(2026, 8, 3, 10, 0));
                    return saved;
                });

        PerformanceReviewResponse response =
                performanceReviewService.submitReview(request(4, "employer@example.com"));

        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getWorkerId()).isEqualTo(10L);
        assertThat(response.getJobId()).isEqualTo(1L);
        assertThat(response.getRating()).isEqualTo(4);
        assertThat(response.getRemarks()).isEqualTo("Great work");
        assertThat(response.getReviewedBy()).isEqualTo("employer@example.com");
        verify(performanceReviewRepository).save(any(PerformanceReview.class));
    }

    @Test
    @DisplayName("submitReview should reject a rating below 1")
    void submitReview_rejectsRatingBelowOne() {
        assertThatThrownBy(() -> performanceReviewService.submitReview(request(0, "admin")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("between 1 and 5");
    }

    @Test
    @DisplayName("submitReview should reject a rating above 5")
    void submitReview_rejectsRatingAboveFive() {
        assertThatThrownBy(() -> performanceReviewService.submitReview(request(6, "admin")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("between 1 and 5");
    }

    @Test
    @DisplayName("getWorkerPerformance should return reviews with the rounded average rating")
    void getWorkerPerformance_returnsReviewsAndAverage() {
        Long workerId = 10L;
        List<PerformanceReview> reviews = List.of(
                PerformanceReview.builder().id(2L).workerId(workerId).jobId(1L)
                        .rating(5).remarks("Excellent").reviewedBy("employer@example.com")
                        .createdAt(LocalDateTime.of(2026, 8, 3, 10, 0)).build(),
                PerformanceReview.builder().id(1L).workerId(workerId).jobId(1L)
                        .rating(4).remarks("Good").reviewedBy("admin@example.com")
                        .createdAt(LocalDateTime.of(2026, 8, 1, 9, 0)).build());
        when(performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(workerId))
                .thenReturn(reviews);
        when(performanceReviewRepository.findAverageRatingByWorkerId(workerId))
                .thenReturn(4.5);

        WorkerPerformanceReport report = performanceReviewService.getWorkerPerformance(workerId);

        assertThat(report.getWorkerId()).isEqualTo(workerId);
        assertThat(report.getReviewCount()).isEqualTo(2);
        assertThat(report.getAverageRating()).isEqualTo(4.5);
        assertThat(report.getReviews()).hasSize(2);
        assertThat(report.getReviews().get(0).getRating()).isEqualTo(5);
    }

    @Test
    @DisplayName("getWorkerPerformance should round the average to two decimal places")
    void getWorkerPerformance_roundsAverage() {
        when(performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of());
        when(performanceReviewRepository.findAverageRatingByWorkerId(10L))
                .thenReturn(4.666666666666667);

        WorkerPerformanceReport report = performanceReviewService.getWorkerPerformance(10L);

        assertThat(report.getAverageRating()).isEqualTo(4.67);
        assertThat(report.getReviewCount()).isZero();
    }

    @Test
    @DisplayName("getWorkerPerformance should return a null average when there are no reviews")
    void getWorkerPerformance_returnsNullAverageWhenNoReviews() {
        when(performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of());
        when(performanceReviewRepository.findAverageRatingByWorkerId(10L))
                .thenReturn(null);

        WorkerPerformanceReport report = performanceReviewService.getWorkerPerformance(10L);

        assertThat(report.getAverageRating()).isNull();
        assertThat(report.getReviews()).isEmpty();
    }

    @Test
    @DisplayName("getWorkerHistory should return the requested page with pagination metadata")
    void getWorkerHistory_returnsPageWithMetadata() {
        Long workerId = 10L;
        List<PerformanceReview> pageContent = List.of(
                PerformanceReview.builder().id(3L).workerId(workerId).jobId(1L)
                        .rating(5).reviewedBy("employer@example.com")
                        .createdAt(LocalDateTime.of(2026, 8, 10, 10, 0)).build(),
                PerformanceReview.builder().id(2L).workerId(workerId).jobId(1L)
                        .rating(4).reviewedBy("employer@example.com")
                        .createdAt(LocalDateTime.of(2026, 8, 5, 10, 0)).build());
        when(performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(
                eq(workerId), any(Pageable.class)))
                .thenReturn(new PageImpl<>(pageContent, PageRequest.of(1, 2), 5));
        when(performanceReviewRepository.findAverageRatingByWorkerId(workerId))
                .thenReturn(4.4);

        WorkerPerformanceReport report = performanceReviewService.getWorkerHistory(workerId, 1, 2);

        assertThat(report.getWorkerId()).isEqualTo(workerId);
        assertThat(report.getReviewCount()).isEqualTo(5);
        assertThat(report.getAverageRating()).isEqualTo(4.4);
        assertThat(report.getReviews()).hasSize(2);
        assertThat(report.getPage()).isEqualTo(1);
        assertThat(report.getSize()).isEqualTo(2);
        assertThat(report.getTotalPages()).isEqualTo(3);
        assertThat(report.getTotalElements()).isEqualTo(5);
    }

    @Test
    @DisplayName("getWorkerPerformance should include a full 1-5 rating distribution")
    void getWorkerPerformance_returnsRatingDistribution() {
        when(performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of());
        when(performanceReviewRepository.findRatingCountsByWorkerId(10L))
                .thenReturn(List.of(
                        RatingCount.builder().rating(4).count(1).build(),
                        RatingCount.builder().rating(5).count(2).build()));

        WorkerPerformanceReport report = performanceReviewService.getWorkerPerformance(10L);

        assertThat(report.getRatingDistribution()).hasSize(5);
        assertThat(report.getRatingDistribution().get(0).getRating()).isEqualTo(1);
        assertThat(report.getRatingDistribution().get(0).getCount()).isZero();
        assertThat(report.getRatingDistribution().get(1).getRating()).isEqualTo(2);
        assertThat(report.getRatingDistribution().get(1).getCount()).isZero();
        assertThat(report.getRatingDistribution().get(2).getRating()).isEqualTo(3);
        assertThat(report.getRatingDistribution().get(2).getCount()).isZero();
        assertThat(report.getRatingDistribution().get(3).getRating()).isEqualTo(4);
        assertThat(report.getRatingDistribution().get(3).getCount()).isEqualTo(1);
        assertThat(report.getRatingDistribution().get(4).getRating()).isEqualTo(5);
        assertThat(report.getRatingDistribution().get(4).getCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("getWorkerHistory should include the overall rating distribution (not page-scoped)")
    void getWorkerHistory_returnsOverallRatingDistribution() {
        when(performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(
                eq(10L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 2), 3));
        when(performanceReviewRepository.findRatingCountsByWorkerId(10L))
                .thenReturn(List.of(RatingCount.builder().rating(5).count(3).build()));

        WorkerPerformanceReport report = performanceReviewService.getWorkerHistory(10L, 0, 2);

        assertThat(report.getReviewCount()).isEqualTo(3);
        assertThat(report.getRatingDistribution()).hasSize(5);
        assertThat(report.getRatingDistribution().get(4).getRating()).isEqualTo(5);
        assertThat(report.getRatingDistribution().get(4).getCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("getWorkerHistory should reject an invalid page or size")
    void getWorkerHistory_rejectsInvalidPagination() {
        assertThatThrownBy(() -> performanceReviewService.getWorkerHistory(10L, -1, 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Page");
        assertThatThrownBy(() -> performanceReviewService.getWorkerHistory(10L, 0, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Size");
        assertThatThrownBy(() -> performanceReviewService.getWorkerHistory(10L, 0, 101))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Size");
    }

    @Test
    @DisplayName("updateReview should update rating and remarks and keep identity/audit fields")
    void updateReview_updatesFields() {
        Long id = 1L;
        LocalDateTime updatedAt = LocalDateTime.of(2026, 8, 3, 12, 0);
        PerformanceReview existing = PerformanceReview.builder()
                .id(id).workerId(10L).jobId(1L).rating(3)
                .remarks("Old remarks").reviewedBy("employer@example.com")
                .createdAt(LocalDateTime.of(2026, 8, 1, 9, 0)).build();
        when(performanceReviewRepository.findById(id)).thenReturn(Optional.of(existing));
        when(performanceReviewRepository.saveAndFlush(any(PerformanceReview.class)))
                .thenAnswer(invocation -> {
                    PerformanceReview saved = invocation.getArgument(0);
                    saved.setUpdatedAt(updatedAt);
                    return saved;
                });

        PerformanceReviewUpdateRequest update = new PerformanceReviewUpdateRequest();
        update.setRating(5);
        update.setRemarks("Revised after follow-up");

        PerformanceReviewResponse response = performanceReviewService.updateReview(id, update);

        assertThat(response.getId()).isEqualTo(id);
        assertThat(response.getRating()).isEqualTo(5);
        assertThat(response.getRemarks()).isEqualTo("Revised after follow-up");
        assertThat(response.getWorkerId()).isEqualTo(10L);
        assertThat(response.getReviewedBy()).isEqualTo("employer@example.com");
        assertThat(response.getUpdatedAt()).isEqualTo(updatedAt);
        verify(performanceReviewRepository).saveAndFlush(existing);
    }

    @Test
    @DisplayName("updateReview should propagate an optimistic-lock conflict")
    void updateReview_propagatesOptimisticLockConflict() {
        PerformanceReview existing = PerformanceReview.builder()
                .id(1L).workerId(10L).jobId(1L).rating(3)
                .reviewedBy("employer@example.com").build();
        when(performanceReviewRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(performanceReviewRepository.saveAndFlush(any(PerformanceReview.class)))
                .thenThrow(new ObjectOptimisticLockingFailureException(
                        "PerformanceReview", 1L, null));

        PerformanceReviewUpdateRequest update = new PerformanceReviewUpdateRequest();
        update.setRating(4);

        assertThatThrownBy(() -> performanceReviewService.updateReview(1L, update))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
    }

    @Test
    @DisplayName("updateReview should throw ResourceNotFoundException when the review does not exist")
    void updateReview_rejectsMissingReview() {
        when(performanceReviewRepository.findById(99L)).thenReturn(Optional.empty());

        PerformanceReviewUpdateRequest update = new PerformanceReviewUpdateRequest();
        update.setRating(4);

        assertThatThrownBy(() -> performanceReviewService.updateReview(99L, update))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("PerformanceReview not found with id");

        verify(performanceReviewRepository, never()).save(any(PerformanceReview.class));
    }

    @Test
    @DisplayName("updateReview should reject a rating outside 1-5 before touching the repository")
    void updateReview_rejectsInvalidRating() {
        PerformanceReviewUpdateRequest update = new PerformanceReviewUpdateRequest();
        update.setRating(9);

        assertThatThrownBy(() -> performanceReviewService.updateReview(1L, update))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("between 1 and 5");

        verify(performanceReviewRepository, never()).findById(any());
    }

    @Test
    @DisplayName("deleteReview should delete an existing review")
    void deleteReview_deletesExisting() {
        when(performanceReviewRepository.existsById(1L)).thenReturn(true);

        performanceReviewService.deleteReview(1L);

        verify(performanceReviewRepository).deleteById(1L);
    }

    @Test
    @DisplayName("deleteReview should throw ResourceNotFoundException when the review does not exist")
    void deleteReview_rejectsMissingReview() {
        when(performanceReviewRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> performanceReviewService.deleteReview(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("PerformanceReview not found with id");

        verify(performanceReviewRepository, never()).deleteById(any());
    }
}
