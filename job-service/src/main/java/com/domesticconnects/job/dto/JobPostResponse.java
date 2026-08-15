package com.domesticconnects.job.dto;

import com.domesticconnects.job.entity.JobStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobPostResponse {

    private Long id;
    private String title;
    private String description;
    private Long employerId;
    /** Worker assigned to the post, or {@code null} while it is still OPEN. */
    private Long workerId;
    /**
     * Whether the employer reviewed the worker's profile before assigning
     * ({@code false} while the post is OPEN or self-assigned by a worker).
     */
    private boolean profileReviewed;
    private BigDecimal wagePerDay;
    private String location;
    private JobStatus status;
    private LocalDateTime createdAt;
}
