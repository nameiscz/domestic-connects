/** Renders a 1–5 star row (filled ★ for the rating, dim ☆ for the rest). */
export function StarRow({ rating, count = 5 }) {
  const value = Math.round(Number(rating) || 0);
  return (
    <span className="text-warning" role="img" aria-label={`${value} out of ${count} stars`}>
      {'★'.repeat(Math.min(Math.max(value, 0), count))}
      {'☆'.repeat(Math.max(count - value, 0))}
    </span>
  );
}

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

/**
 * Worker profile summary — the "profile review" an employer sees before
 * assigning: average rating, review count, the rating distribution and the
 * most recent reviews. Data comes from GET /api/performance/worker/{id}.
 *
 * - `report`: the WorkerPerformanceReport payload (may be null while loading).
 * - `loading`: shows a small spinner instead of the card.
 * - `compact`: hides the review history (used inside the assign modal).
 */
export default function WorkerProfileCard({
  report,
  workerName,
  loading = false,
  compact = false,
}) {
  if (loading) {
    return (
      <div className="text-center py-3">
        <span className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading profile…</span>
        </span>
        <p className="text-muted small mt-2 mb-0">
          Loading {workerName || 'worker'}&apos;s profile…
        </p>
      </div>
    );
  }

  const averageRating = report?.averageRating;
  const reviewCount = report?.reviewCount ?? 0;
  const reviews = Array.isArray(report?.reviews) ? report.reviews : [];
  const distribution = Array.isArray(report?.ratingDistribution)
    ? report.ratingDistribution
    : [];

  return (
    <div className="card border bg-body-tertiary">
      <div className="card-body py-3">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div className="flex-shrink-0 text-center" style={{ minWidth: 72 }}>
            <div className={`fs-4 fw-bold ${averageRating == null ? 'text-muted' : 'text-warning'}`}>
              {averageRating == null ? '—' : averageRating}
            </div>
            <div className="text-muted small text-uppercase" style={{ fontSize: '0.68rem' }}>
              / 5 rating
            </div>
          </div>
          <div>
            <StarRow rating={averageRating} />
            <div className="text-muted small">
              {reviewCount} review{reviewCount === 1 ? '' : 's'}
              {averageRating == null ? ' — no ratings yet' : ''}
            </div>
          </div>
          {!compact && distribution.length > 0 && (
            <div className="ms-auto flex-shrink-0" style={{ minWidth: 180 }}>
              {distribution.map((bucket) => (
                <div key={bucket.rating} className="d-flex align-items-center gap-2 small">
                  <span className="text-warning" style={{ width: 60 }}>
                    {'★'.repeat(bucket.rating)}
                  </span>
                  <div className="progress flex-grow-1" style={{ height: 6 }}>
                    <div
                      className="progress-bar bg-warning"
                      role="progressbar"
                      style={{
                        width: `${
                          reviewCount === 0
                            ? 0
                            : Math.max(4, (bucket.count / reviewCount) * 100)
                        }%`,
                      }}
                      aria-valuenow={bucket.count}
                      aria-valuemin={0}
                      aria-valuemax={reviewCount}
                    />
                  </div>
                  <span className="text-muted" style={{ width: 22 }}>
                    {bucket.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {reviews.length > 0 && (
          <div className="mt-3 border-top pt-2">
            <div className="text-muted small text-uppercase mb-1">Recent reviews</div>
            <ul className="list-unstyled mb-0">
              {reviews.slice(0, compact ? 2 : 3).map((review) => (
                <li key={review.id} className="d-flex align-items-start gap-2 py-1">
                  <StarRow rating={review.rating} />
                  <div className="small flex-grow-1">
                    {review.remarks ? (
                      <span className="text-truncate d-inline-block" style={{ maxWidth: 320 }}>
                        “{review.remarks}”
                      </span>
                    ) : (
                      <span className="text-muted">No remarks</span>
                    )}
                    <span className="text-muted"> — {review.reviewedBy || 'Employer'}</span>
                  </div>
                  <span className="text-muted small flex-shrink-0">
                    {formatDate(review.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
