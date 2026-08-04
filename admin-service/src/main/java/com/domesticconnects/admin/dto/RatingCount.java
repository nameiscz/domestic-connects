package com.domesticconnects.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Mirror of {@code com.domesticconnects.performance.dto.RatingCount}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RatingCount {

    private int rating;
    private long count;
}
