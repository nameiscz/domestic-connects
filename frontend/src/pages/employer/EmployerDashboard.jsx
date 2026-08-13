import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatWage } from '../../utils/jobFormat';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';

// ---------------------------------------------------------------------------
// Employer overview — summary cards derived from GET /api/jobs (filtered to
// the signed-in employer) plus per-worker performance reports (GET
// /api/performance/worker/{id}). One job assignment maps to one hired worker,
// so the "workers hired" count is the number of ASSIGNED postings, the rating
// card pools the reports of those hired workers, and the breakdown panel
// lists each hired worker's own average rating and review count.
// ---------------------------------------------------------------------------

/** Renders a 1–5 star row (filled ★ for the rating, dim ☆ for the rest). */
function Stars({ rating }) {
  const value = Math.round(Number(rating) || 0);
  return (
    <span className="text-warning" role="img" aria-label={`${value} out of 5 stars`}>
      {'★'.repeat(Math.min(Math.max(value, 0), 5))}
      {'☆'.repeat(Math.max(5 - value, 0))}
    </span>
  );
}

export default function EmployerDashboard() {
  const { currentUser } = useAuth();
  const employerId = currentUser?.id;
  const { pathname } = useLocation();
  const isOverview = pathname === '/employer' || pathname === '/employer/';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        // Jobs and the worker directory load in parallel; a failing worker
        // list degrades to empty (names fall back to "Worker #id").
        const [{ data: jobsData }, workersRes] = await Promise.all([
          axiosInstance.get('/api/jobs', { signal }),
          axiosInstance.get('/api/auth/workers', { signal }).catch(() => ({ data: { data: [] } })),
        ]);
        const mine = (Array.isArray(jobsData) ? jobsData : []).filter(
          (job) => String(job.employerId) === String(employerId)
        );
        const open = mine.filter((job) => job.status === 'OPEN');
        const assigned = mine.filter((job) => job.status === 'ASSIGNED');

        // Average daily wage across currently open postings.
        const avgWage =
          open.length === 0
            ? null
            : open.reduce((sum, job) => sum + Number(job.wagePerDay || 0), 0) /
              open.length;

        // Resolve worker names from the auth directory.
        const workerNameById = new Map(
          (Array.isArray(workersRes?.data?.data) ? workersRes.data.data : [])
            .filter((w) => w?.id != null)
            .map((w) => [String(w.id), w.name])
        );

        // Worker-performance summary: fetch each hired worker's report (the
        // job payload carries the persisted assignee) and pool the results.
        // One worker's failure is skipped rather than failing the dashboard.
        const workerIds = [
          ...new Set(
            assigned
              .map((job) => job.workerId)
              .filter((id) => id != null)
              .map(String)
          ),
        ];
        const results = await Promise.allSettled(
          workerIds.map((id) =>
            axiosInstance.get(`/api/performance/worker/${id}`, { signal })
          )
        );

        let ratingSum = 0;
        let ratedWorkers = 0;
        let perfReviews = 0;
        const breakdown = results.map((result, index) => {
          const report = result.status === 'fulfilled' ? result.value?.data : null;
          const reviewCount = report ? Number(report.reviewCount || 0) : 0;
          perfReviews += reviewCount;
          if (report?.averageRating != null) {
            ratingSum += Number(report.averageRating);
            ratedWorkers += 1;
          }
          return {
            workerId: workerIds[index],
            name: workerNameById.get(workerIds[index]) || `Worker #${workerIds[index]}`,
            averageRating: report?.averageRating ?? null,
            reviewCount,
            unavailable: !report,
          };
        });

        setStats({
          total: mine.length,
          open: open.length,
          hired: assigned.length,
          avgWage,
          perfAvg: ratedWorkers === 0 ? null : ratingSum / ratedWorkers,
          perfReviews,
          perfWorkers: workerIds.length,
          breakdown,
        });
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setError(err.response?.data?.message || 'Unable to load your dashboard.');
        }
      } finally {
        setLoading(false);
      }
    },
    [employerId]
  );

  useEffect(() => {
    if (!isOverview || !employerId) return undefined;
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [isOverview, employerId, fetchStats]);

  return (
    <DashboardLayout title="Employer Dashboard" accent="success">
      {isOverview && (
        <>
          {/* Welcome banner */}
          <div className="card border-0 bg-success text-white shadow-sm mb-4">
            <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <h5 className="card-title mb-1">Welcome back, {currentUser?.name}!</h5>
                <p className="card-text text-white-50 mb-0">
                  Post new openings, keep track of your postings and manage the
                  workers assigned to them.
                </p>
              </div>
              <Link to="/employer/jobs/new" className="btn btn-light btn-sm">
                + Post a job
              </Link>
            </div>
          </div>

          {!employerId ? (
            <div className="card shadow-sm">
              <div className="card-body text-center py-5">
                <p className="fs-4 mb-1">🏢</p>
                <h5 className="card-title">Account not recognised</h5>
                <p className="card-text text-muted mb-0">
                  We couldn&apos;t identify your account. Please sign in again.
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-5" data-testid="employer-dashboard-loading">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading dashboard…</span>
              </div>
              <p className="text-muted mt-3 mb-0">Crunching your numbers…</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger shadow-sm" role="alert">
              <h4 className="alert-heading h6">Couldn&apos;t load your dashboard</h4>
              <p className="mb-2">{error}</p>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={fetchStats}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="row g-3">
                <StatCard
                  emoji="🚀"
                  label="Active job posts"
                  value={stats?.open ?? 0}
                  note="Currently open for applications"
                  accent="success"
                />
                <StatCard
                  emoji="📋"
                  label="Total job posts"
                  value={stats?.total ?? 0}
                  note="Posted so far, across all statuses"
                  accent="primary"
                />
                <StatCard
                  emoji="🤝"
                  label="Workers hired"
                  value={stats?.hired ?? 0}
                  note="Assigned to your job postings"
                  accent="warning"
                />
                <StatCard
                  emoji="⭐"
                  label="Avg. worker rating"
                  value={stats?.perfAvg == null ? '—' : `${Number(stats.perfAvg).toFixed(2)} / 5`}
                  note={
                    stats?.perfReviews == null || stats.perfReviews === 0
                      ? 'No reviews yet'
                      : `${stats.perfReviews} review${stats.perfReviews === 1 ? '' : 's'} across ${stats.perfWorkers ?? 0} worker${stats.perfWorkers === 1 ? '' : 's'}`
                  }
                  accent="warning"
                />
                <StatCard
                  emoji="💵"
                  label="Avg. wage / day"
                  value={stats?.avgWage == null ? '—' : formatWage(stats.avgWage)}
                  note={stats?.avgWage == null ? 'No open postings yet' : 'Across open jobs'}
                  accent="info"
                />
              </div>

              {/* Per-worker rating breakdown */}
              <div className="card shadow-sm mt-4">
                <div className="card-header bg-white">
                  <h4 className="h6 mb-0">Worker rating breakdown</h4>
                </div>
                <div className="card-body py-2">
                  {(stats?.breakdown ?? []).length === 0 ? (
                    <p className="text-muted small my-2 mb-0">
                      No hired workers yet — assign a worker to a job to see
                      their ratings here.
                    </p>
                  ) : (
                    stats.breakdown.map((entry) => (
                      <div
                        key={entry.workerId}
                        className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom"
                      >
                        <span className="fw-semibold flex-shrink-0" style={{ minWidth: 200 }}>
                          {entry.name}
                        </span>
                        {entry.unavailable ? (
                          <span className="text-muted small">Ratings unavailable</span>
                        ) : entry.averageRating == null ? (
                          <span className="text-muted small">No reviews yet</span>
                        ) : (
                          <>
                            <Stars rating={entry.averageRating} />
                            <span className="text-muted small">
                              {entry.averageRating}/5
                            </span>
                          </>
                        )}
                        <span
                          className={`badge ms-auto ${entry.reviewCount > 0 ? 'bg-light text-dark border' : 'bg-light text-muted border'}`}
                        >
                          {entry.reviewCount} review{entry.reviewCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Nested routes (e.g. /employer/jobs) render here inside the shell. */}
      <Outlet />
    </DashboardLayout>
  );
}
