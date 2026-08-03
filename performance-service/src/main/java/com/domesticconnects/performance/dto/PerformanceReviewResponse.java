package com.domesticconnects.performance.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

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
