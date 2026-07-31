package com.domesticconnects.job.dto;

import com.domesticconnects.job.entity.JobStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class JobPostResponse {

    private Long id;
    private String title;
    private String description;
    private Long employerId;
    private BigDecimal wagePerDay;
    private String location;
    private JobStatus status;
    private LocalDateTime createdAt;
}
