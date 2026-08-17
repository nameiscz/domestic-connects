/**
 * Performance domain types — mirrors performance-service
 * `PerformanceReviewResponse`, `WorkerPerformanceReport` and `RatingCount`.
 */

export interface PerformanceReview {
  id: number;
  workerId: number;
  jobId: number;
  rating: number;
  remarks: string;
  reviewedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** One bucket of the rating distribution (ratings 1–5, zeros included). */
export interface RatingCount {
  rating: number;
  count: number;
}

export interface WorkerPerformanceReport {
  workerId: number;
  reviewCount: number;
  /** Null while the worker has no reviews yet. */
  averageRating: number | null;
  reviews: PerformanceReview[];
  ratingDistribution: RatingCount[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

export interface SubmitReviewPayload {
  workerId: number;
  jobId: number;
  rating: number;
  remarks?: string;
  reviewedBy: string;
}
