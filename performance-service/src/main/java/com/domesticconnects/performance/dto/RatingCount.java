package com.domesticconnects.performance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One bucket of a worker's rating distribution: how many reviews carry a given
 * rating (1-5 stars). The full distribution always contains all five buckets,
 * including zero counts, so consumers can render a complete histogram without
 * guessing missing ratings.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RatingCount {

    private int rating;
    private long count;
}
