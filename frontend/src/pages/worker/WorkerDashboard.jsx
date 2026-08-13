import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatWage } from '../../utils/jobFormat';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';

// ---------------------------------------------------------------------------
// Worker overview — summary cards.
//
//   • Open jobs available   → real   GET /api/jobs
//   • Salary this month     → real   GET /api/payroll/{id}/history?month=&year=
//   • Attendance this month → real   GET /api/attendance/worker/{id}?month=&year=
//   • Jobs applied          → real   GET /api/jobs — postings whose persisted
//                                      workerId matches the signed-in worker
//                                      (workers "apply" by self-assigning).
// ---------------------------------------------------------------------------

export default function WorkerDashboard() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;
  const { pathname } = useLocation();
  const isOverview = pathname === '/worker' || pathname === '/worker/';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [partialFailure, setPartialFailure] = useState(false);

  const fetchStats = useCallback(
    async (signal) => {
      setLoading(true);
      setPartialFailure(false);

      const now = new Date();
      const period = { month: now.getMonth() + 1, year: now.getFullYear() };

      // All three calls are independent — fetch in parallel and let each card
      // render whatever made it back (a single outage shouldn't blank the page).
      const [jobsRes, payrollRes, attendanceRes] = await Promise.allSettled([
        axiosInstance.get('/api/jobs', { signal }),
        axiosInstance.get(
          `/api/payroll/${workerId}/history?month=${period.month}&year=${period.year}`,
          { signal }
        ),
        axiosInstance.get(
          `/api/attendance/worker/${workerId}?month=${period.month}&year=${period.year}`,
          { signal }
        ),
      ]);

      // Ignore results after the request was aborted (unmount / navigation).
      if (signal.aborted) return;

      const failed = [jobsRes, payrollRes, attendanceRes].filter(
        (r) => r.status === 'rejected'
      ).length;
      if (failed > 0) setPartialFailure(true);

      const jobs = Array.isArray(jobsRes.value?.data) ? jobsRes.value.data : [];
      const salaryRecords = Array.isArray(payrollRes.value?.data?.data)
        ? payrollRes.value.data.data
        : [];
      const attendanceSummary = attendanceRes.value?.data?.summary ?? null;

      setStats({
        period,
        openJobs: jobs.filter((job) => job.status === 'OPEN').length,
        appliedJobs: jobs.filter(
          (job) => String(job.workerId) === String(workerId)
        ).length,
        salaryThisMonth: salaryRecords[0]?.grossSalary ?? null,
        attendance: attendanceSummary,
      });
      setLoading(false);
    },
    [workerId]
  );

  useEffect(() => {
    if (!isOverview || !workerId) return undefined;
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [isOverview, workerId, fetchStats]);

  const periodLabel =
    stats?.period &&
    new Date(stats.period.year, stats.period.month - 1).toLocaleString('en-US', {
      month: 'long',
    }) + ` ${stats.period.year}`;

  return (
    <DashboardLayout title="Worker Dashboard">
      {isOverview && (
        <>
          {/* Welcome banner */}
          <div className="card border-0 bg-primary text-white shadow-sm mb-4">
            <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <h5 className="card-title mb-1">Welcome back, {currentUser?.name}!</h5>
                <p className="card-text text-white-50 mb-0">
                  Find your next job, track attendance and review your earnings
                  all from one place.
                </p>
              </div>
              <Link to="/worker/jobs" className="btn btn-light btn-sm">
                Browse jobs
              </Link>
            </div>
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
            <div className="text-center py-5" data-testid="worker-dashboard-loading">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading dashboard…</span>
              </div>
              <p className="text-muted mt-3 mb-0">Crunching your numbers…</p>
            </div>
          ) : (
            <>
              {partialFailure && (
                <div className="alert alert-warning py-2" role="alert">
                  <small>
                    Some stats couldn&apos;t be loaded right now — the rest are
                    shown below.
                  </small>
                </div>
              )}

              <div className="row g-3">
                <StatCard
                  emoji="🧾"
                  label="Jobs applied"
                  value={stats?.appliedJobs ?? '—'}
                  note={
                    stats?.appliedJobs == null
                      ? 'Jobs you are assigned to'
                      : stats.appliedJobs === 0
                        ? 'Browse the jobs page to apply'
                        : 'Jobs you are assigned to'
                  }
                  accent="primary"
                />
                <StatCard
                  emoji="💰"
                  label="Salary this month"
                  value={
                    stats?.salaryThisMonth == null
                      ? '—'
                      : formatWage(stats.salaryThisMonth)
                  }
                  note={
                    stats?.salaryThisMonth == null
                      ? 'No payslip generated yet'
                      : periodLabel
                  }
                  accent="success"
                />
                <StatCard
                  emoji="📅"
                  label="Attendance this month"
                  value={
                    stats?.attendance
                      ? `${stats.attendance.presentDays ?? 0}/${stats.attendance.totalDays ?? 0}`
                      : '—'
                  }
                  note={
                    stats?.attendance ? 'days present' : 'No records marked yet'
                  }
                  accent="warning"
                />
                <StatCard
                  emoji="🗂️"
                  label="Open jobs available"
                  value={stats?.openJobs ?? '—'}
                  note="New opportunities are added regularly"
                  accent="info"
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Nested routes (e.g. /worker/jobs) render here inside the shell. */}
      <Outlet />
    </DashboardLayout>
  );
}
