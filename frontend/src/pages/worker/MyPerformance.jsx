import { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/jobFormat';
import StatCard from '../../components/StatCard';

const STAR_COUNT = 5;

/** Renders a 1–5 star row (filled ★ for the rating, dim ☆ for the rest). */
function Stars({ rating }) {
  const value = Number(rating) || 0;
  return (
    <span className="text-warning" role="img" aria-label={`${value} out of ${STAR_COUNT} stars`}>
      {'★'.repeat(Math.min(Math.max(value, 0), STAR_COUNT))}
      {'☆'.repeat(Math.max(STAR_COUNT - value, 0))}
    </span>
  );
}

/**
 * MyPerformance — the logged-in worker's own performance history
 * (GET /api/performance/worker/{id} via the API gateway). The backend only
 * permits WORKER callers to read their own reviews, so no picker is needed.
 * Payload is a WorkerPerformanceReport: reviewCount, averageRating,
 * reviews[] and a ratingDistribution histogram covering 1–5.
 */
export default function MyPerformance() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(Boolean(workerId));
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!workerId) {
      setReport(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axiosInstance.get(
          `/api/performance/worker/${workerId}`,
          { signal: controller.signal }
        );
        setReport(data);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setError(
            err.response?.data?.message ||
              'Unable to load your performance reviews.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [workerId, refresh]);

  const reviews = report?.reviews ?? [];
  const distribution = report?.ratingDistribution ?? [];
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <section aria-busy={loading}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">My performance</h3>
        <span className="text-muted small">
          Reviews submitted by your employers
        </span>
      </div>

      {!workerId ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">👷</p>
            <h5 className="card-title">Account not recognised</h5>
            <p className="card-text text-muted mb-0">
              We couldn&apos;t identify your account. Please sign in again.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="text-center py-5" data-testid="performance-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading performance…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching your reviews…</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load your performance</h4>
          <p className="mb-2">{error}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => setRefresh((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">🌟</p>
            <h5 className="card-title">No reviews yet</h5>
            <p className="card-text text-muted mb-0">
              Your employers will review your work after each job.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="row g-3 mb-4">
            <StatCard
              emoji="⭐"
              label="Average rating"
              value={
                report.averageRating == null ? (
                  '—'
                ) : (
                  <>
                    {report.averageRating}
                    <span className="text-muted fs-6"> / 5</span>
                  </>
                )
              }
              note={
                report.averageRating == null
                  ? 'No ratings yet'
                  : `Across ${report.reviewCount} review${report.reviewCount === 1 ? '' : 's'}`
              }
              accent="warning"
            />
            <StatCard
              emoji="📝"
              label="Total reviews"
              value={report.reviewCount}
              note="Submitted by your employers"
              accent="primary"
            />
          </div>

          {/* Rating histogram (backend always returns buckets 1–5, zeros included) */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-white">
              <h4 className="h6 mb-0">Rating breakdown</h4>
            </div>
            <div className="card-body">
              {distribution.map((bucket) => (
                <div key={bucket.rating} className="d-flex align-items-center gap-3 mb-2">
                  <span className="text-warning flex-shrink-0" style={{ width: 90 }}>
                    {'★'.repeat(bucket.rating)}
                  </span>
                  <div className="progress flex-grow-1" style={{ height: 10 }}>
                    <div
                      className="progress-bar bg-warning"
                      role="progressbar"
                      style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                      aria-valuenow={bucket.count}
                      aria-valuemin={0}
                      aria-valuemax={maxCount}
                    />
                  </div>
                  <span className="text-muted small flex-shrink-0" style={{ width: 30 }}>
                    {bucket.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Review history */}
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h4 className="h6 mb-0">Review history</h4>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Rating</th>
                    <th>Remarks</th>
                    <th>Reviewed by</th>
                    <th>Job</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review.id}>
                      <td>
                        <Stars rating={review.rating} />
                        <span className="text-muted small ms-1">
                          ({review.rating}/5)
                        </span>
                      </td>
                      <td className="text-muted">
                        {review.remarks || '—'}
                      </td>
                      <td>{review.reviewedBy || '—'}</td>
                      <td className="text-muted">#{review.jobId ?? '—'}</td>
                      <td className="text-muted">{formatDate(review.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
