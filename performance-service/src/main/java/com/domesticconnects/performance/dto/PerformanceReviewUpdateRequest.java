package com.domesticconnects.performance.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

/**
 * Fields editable on an existing review. {@code workerId}, {@code jobId} and
 * {@code reviewedBy} are identity/audit fields and are deliberately not
 * mutable — only the rating and remarks can change.
 */
@Data
public class PerformanceReviewUpdateRequest {

    @NotNull(message = "Rating is required")
    @Min(value = 1, message = "Rating must be between 1 and 5")
    @Max(value = 5, message = "Rating must be between 1 and 5")
    private Integer rating;

    @Size(max = 1000, message = "Remarks must not exceed 1000 characters")
    private String remarks;
}
