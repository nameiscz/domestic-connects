package com.domesticconnects.performance.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class PerformanceReviewRequest {

    @NotNull(message = "Worker ID is required")
    @Positive(message = "Worker ID must be a positive number")
    private Long workerId;

    @NotNull(message = "Job ID is required")
    @Positive(message = "Job ID must be a positive number")
    private Long jobId;

    @NotNull(message = "Rating is required")
    @Min(value = 1, message = "Rating must be between 1 and 5")
    @Max(value = 5, message = "Rating must be between 1 and 5")
    private Integer rating;

    @Size(max = 1000, message = "Remarks must not exceed 1000 characters")
    private String remarks;

    @NotBlank(message = "Reviewed by is required")
    @Size(max = 100, message = "Reviewed by must not exceed 100 characters")
    private String reviewedBy;
}
