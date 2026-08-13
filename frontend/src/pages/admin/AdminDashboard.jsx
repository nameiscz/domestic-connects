import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';

/**
 * AdminDashboard — live platform summary (GET /api/admin/dashboard/summary,
 * ApiResponse-wrapped) plus quick links to the admin sections. Downstream
 * failures resolve to zero/null server-side (circuit-breaker fallbacks), so
 * the cards render with dashes rather than erroring out.
 */
export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axiosInstance.get('/api/admin/dashboard/summary', {
          signal: controller.signal,
        });
        setSummary(data?.data ?? null);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setError(
            err.response?.data?.message || 'Unable to load the dashboard summary.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <DashboardLayout title="Admin Dashboard" accent="danger">
      {/* Welcome banner */}
      <div className="card border-0 bg-danger text-white shadow-sm mb-4">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h5 className="card-title mb-1">Platform overview</h5>
            <p className="card-text text-white-50 mb-0">
              Manage users, jobs, attendance and analytics from one place.
            </p>
          </div>
          <Link to="/admin/analytics" className="btn btn-light btn-sm">
            View analytics
          </Link>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load the summary</h4>
          <p className="mb-2">{error}</p>
          <Link to="/admin" className="btn btn-outline-danger btn-sm">
            Reload
          </Link>
        </div>
      ) : loading ? (
        <div className="text-center py-5" data-testid="admin-dashboard-loading">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading dashboard…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Crunching your numbers…</p>
        </div>
      ) : (
        <>
          <div className="row g-3">
            <StatCard
              emoji="👥"
              label="Total users"
              value={summary?.totalUsers ?? '—'}
              note={`${summary?.activeUsers ?? '—'} active`}
              accent="danger"
            />
            <StatCard
              emoji="🗂️"
              label="Total jobs"
              value={summary?.totalJobs ?? '—'}
              note={`${summary?.activeJobs ?? '—'} active`}
              accent="primary"
            />
            <StatCard
              emoji="📅"
              label="Attendance rate"
              value={
                summary?.monthlyAttendanceRate == null
                  ? '—'
                  : `${Number(summary.monthlyAttendanceRate).toFixed(1)}%`
              }
              note="This month"
              accent="success"
            />
            <StatCard
              emoji="⭐"
              label="Avg. rating"
              value={
                summary?.averagePerformanceRating == null
                  ? '—'
                  : `${Number(summary.averagePerformanceRating).toFixed(2)} / 5`
              }
              note={
                summary?.totalReviews == null
                  ? 'Across workers'
                  : `${summary.totalReviews} review${summary.totalReviews === 1 ? '' : 's'} across workers`
              }
              accent="warning"
            />
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
