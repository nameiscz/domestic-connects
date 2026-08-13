import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import StatCard from '../../components/StatCard';

const ROLE_LABEL = { ADMIN: 'Admins', EMPLOYER: 'Employers', WORKER: 'Workers' };
const JOB_STATUS_LABEL = { OPEN: 'Open', ASSIGNED: 'Assigned', CLOSED: 'Closed' };

/**
 * AdminAnalytics — platform KPIs from the admin-service aggregator
 * (GET /api/admin/dashboard/analytics, ApiResponse-wrapped). Downstream
 * failures resolve to zero/null server-side (circuit-breaker fallbacks), so a
 * missing slice renders as a dash rather than an error.
 */
export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  const loadAnalytics = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosInstance.get('/api/admin/dashboard/analytics', {
        signal,
      });
      setAnalytics(data?.data ?? null);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') {
        setError(
          err.response?.data?.message || 'Unable to load analytics. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics, refresh]);

  const formatRate = (value) =>
    value == null ? '—' : `${Number(value).toFixed(1)}%`;
  const formatRating = (value) =>
    value == null ? '—' : `${Number(value).toFixed(2)} / 5`;

  const usersByRole = analytics?.usersByRole ?? {};
  const jobsByStatus = analytics?.jobsByStatus ?? {};
  const totalUsers = Object.values(usersByRole).reduce((s, n) => s + n, 0);
  const totalJobs =
    (analytics?.activeJobs ?? 0) + (analytics?.inactiveJobs ?? 0);

  return (
    <section aria-busy={loading}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">Analytics</h3>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => setRefresh((r) => r + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5" data-testid="admin-analytics-loading">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading analytics…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Crunching the numbers…</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load analytics</h4>
          <p className="mb-2">{error}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => setRefresh((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Headline KPIs */}
          <div className="row g-3 mb-4">
            <StatCard
              emoji="👥"
              label="Total users"
              value={totalUsers}
              note="Across all roles"
              accent="danger"
            />
            <StatCard
              emoji="🗂️"
              label="Total jobs"
              value={totalJobs}
              note={`${analytics?.activeJobs ?? 0} active · ${analytics?.inactiveJobs ?? 0} inactive`}
              accent="primary"
            />
            <StatCard
              emoji="📅"
              label="Attendance rate"
              value={formatRate(analytics?.monthlyAttendanceRate)}
              note="This month"
              accent="success"
            />
            <StatCard
              emoji="⭐"
              label="Avg. rating"
              value={formatRating(analytics?.averagePerformanceRating)}
              note={
                analytics?.totalReviews == null
                  ? 'Across workers'
                  : `${analytics.totalReviews} review${analytics.totalReviews === 1 ? '' : 's'} across workers`
              }
              accent="warning"
            />
          </div>

          <div className="row g-3">
            {/* Users by role */}
            <div className="col-lg-6">
              <div className="card shadow-sm h-100">
                <div className="card-header bg-white">
                  <h4 className="h6 mb-0">Users by role</h4>
                </div>
                <div className="card-body">
                  {Object.keys(usersByRole).length === 0 ? (
                    <p className="text-muted small mb-0">No data yet.</p>
                  ) : (
                    Object.entries(usersByRole).map(([role, count]) => (
                      <div key={role} className="d-flex align-items-center gap-3 mb-2">
                        <span className="text-muted flex-shrink-0" style={{ width: 110 }}>
                          {ROLE_LABEL[role] || role}
                        </span>
                        <div className="progress flex-grow-1" style={{ height: 10 }}>
                          <div
                            className="progress-bar bg-danger"
                            role="progressbar"
                            style={{
                              width: `${(count / Math.max(1, totalUsers)) * 100}%`,
                            }}
                            aria-valuenow={count}
                            aria-valuemin={0}
                            aria-valuemax={totalUsers}
                          />
                        </div>
                        <span className="text-muted small flex-shrink-0" style={{ width: 30 }}>
                          {count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Jobs by status */}
            <div className="col-lg-6">
              <div className="card shadow-sm h-100">
                <div className="card-header bg-white">
                  <h4 className="h6 mb-0">Jobs by status</h4>
                </div>
                <div className="card-body">
                  {Object.keys(jobsByStatus).length === 0 ? (
                    <p className="text-muted small mb-0">No data yet.</p>
                  ) : (
                    Object.entries(jobsByStatus).map(([status, count]) => (
                      <div key={status} className="d-flex align-items-center gap-3 mb-2">
                        <span className="text-muted flex-shrink-0" style={{ width: 110 }}>
                          {JOB_STATUS_LABEL[status] || status}
                        </span>
                        <div className="progress flex-grow-1" style={{ height: 10 }}>
                          <div
                            className="progress-bar bg-primary"
                            role="progressbar"
                            style={{
                              width: `${(count / Math.max(1, totalJobs)) * 100}%`,
                            }}
                            aria-valuenow={count}
                            aria-valuemin={0}
                            aria-valuemax={totalJobs}
                          />
                        </div>
                        <span className="text-muted small flex-shrink-0" style={{ width: 30 }}>
                          {count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
