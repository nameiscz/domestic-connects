import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatWage } from '../../utils/jobFormat';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';

// ---------------------------------------------------------------------------
// Employer overview — summary cards, all derived from GET /api/jobs (filtered
// to the signed-in employer). One job assignment maps to one hired worker, so
// the "workers hired" count is the number of ASSIGNED postings.
// ---------------------------------------------------------------------------

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
        const { data } = await axiosInstance.get('/api/jobs', { signal });
        const mine = (Array.isArray(data) ? data : []).filter(
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

        setStats({ total: mine.length, open: open.length, hired: assigned.length, avgWage });
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
                emoji="💵"
                label="Avg. wage / day"
                value={stats?.avgWage == null ? '—' : formatWage(stats.avgWage)}
                note={stats?.avgWage == null ? 'No open postings yet' : 'Across open jobs'}
                accent="info"
              />
            </div>
          )}
        </>
      )}

      {/* Nested routes (e.g. /employer/jobs) render here inside the shell. */}
      <Outlet />
    </DashboardLayout>
  );
}
