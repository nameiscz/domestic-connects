package com.domesticconnects.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Mirror of {@code com.domesticconnects.performance.dto.PerformanceReviewResponse}.
 */
@Data
@Builder
public class PerformanceReviewResponse {

    private Long id;
    private Long workerId;
    private Long jobId;
    private Integer rating;
    private String remarks;
    private String reviewedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
