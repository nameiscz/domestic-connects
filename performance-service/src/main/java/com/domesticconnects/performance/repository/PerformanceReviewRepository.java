package com.domesticconnects.performance.repository;

import com.domesticconnects.performance.dto.RatingCount;
import com.domesticconnects.performance.entity.PerformanceReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for {@link PerformanceReview}.
 */
@Repository
public interface PerformanceReviewRepository extends JpaRepository<PerformanceReview, Long> {

    /**
     * All reviews for a worker, most recent first.
     */
    List<PerformanceReview> findByWorkerIdOrderByCreatedAtDesc(Long workerId);

    /**
     * A page of reviews for a worker, most recent first.
     */
    Page<PerformanceReview> findByWorkerIdOrderByCreatedAtDesc(Long workerId, Pageable pageable);

    /**
     * The average rating of a worker's reviews, or {@code null} when the
     * worker has no reviews yet.
     */
    @Query("SELECT AVG(p.rating) FROM PerformanceReview p WHERE p.workerId = :workerId")
    Double findAverageRatingByWorkerId(@Param("workerId") Long workerId);

    /**
     * The number of reviews per rating for a worker. Only ratings that occur
     * are returned; the service layer fills in the missing buckets.
     */
    @Query("SELECT new com.domesticconnects.performance.dto.RatingCount(p.rating, COUNT(p)) "
            + "FROM PerformanceReview p WHERE p.workerId = :workerId GROUP BY p.rating")
    List<RatingCount> findRatingCountsByWorkerId(@Param("workerId") Long workerId);
}
