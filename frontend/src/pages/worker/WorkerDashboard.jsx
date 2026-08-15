import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import {
  Send,
  Wallet,
  CalendarCheck,
  FolderOpen,
  BriefcaseBusiness,
  MapPin,
  CalendarDays,
  Activity,
  Clock,
  Bell,
  Star,
} from 'lucide-react';
import { formatWage } from '../../utils/jobFormat';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';
import JobStatusBadge from '../../components/JobStatusBadge';

// ---------------------------------------------------------------------------
// Worker overview — summary cards plus a today/schedule panel and an activity
// feed, composed from four parallel calls:
//
//   • Open jobs / assignment → GET /api/jobs
//   • Salary this month      → GET /api/payroll/{id}/history?month=&year=
//   • Attendance this month  → GET /api/attendance/worker/{id}?month=&year=
//   • Notifications inbox    → GET /api/notifications/{id}
//
// Every call is independent and failure-tolerant (Promise.allSettled), so a
// single outage degrades to partial cards rather than a blank page.
// ---------------------------------------------------------------------------

/** Title-cases a name ("manideep" → "Manideep") for display in the banner. */
const titleCase = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

/** Compact relative label for the activity feed. */
const dayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const today = new Date();
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startOf(today) - startOf(date)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

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

      // All four calls are independent — fetch in parallel and let each card
      // render whatever made it back (a single outage shouldn't blank the page).
      const [jobsRes, payrollRes, attendanceRes, notifRes] = await Promise.allSettled([
        axiosInstance.get('/api/jobs', { signal }),
        axiosInstance.get(
          `/api/payroll/${workerId}/history?month=${period.month}&year=${period.year}`,
          { signal }
        ),
        axiosInstance.get(
          `/api/attendance/worker/${workerId}?month=${period.month}&year=${period.year}`,
          { signal }
        ),
        axiosInstance.get(`/api/notifications/${workerId}`, { signal }),
      ]);

      // Ignore results after the request was aborted (unmount / navigation).
      if (signal.aborted) return;

      const failed = [jobsRes, payrollRes, attendanceRes, notifRes].filter(
        (r) => r.status === 'rejected'
      ).length;
      if (failed > 0) setPartialFailure(true);

      const jobs = Array.isArray(jobsRes.value?.data) ? jobsRes.value.data : [];
      const salaryRecords = Array.isArray(payrollRes.value?.data?.data)
        ? payrollRes.value.data.data
        : [];
      const attendanceSummary = attendanceRes.value?.data?.summary ?? null;
      const attendanceRecords = Array.isArray(attendanceRes.value?.data?.records)
        ? attendanceRes.value.data.records
        : [];
      const notifications = Array.isArray(notifRes.value?.data)
        ? notifRes.value.data
        : [];

      const assignedJobs = jobs.filter(
        (job) => job.status === 'ASSIGNED' && String(job.workerId) === String(workerId)
      );
      const activeJob = assignedJobs[0] ?? null;

      // "Recent Activity" feed — merge events from every source, newest first.
      const activities = [
        ...jobs
          .filter((job) => String(job.workerId) === String(workerId))
          .map((job) => ({
            key: `job-${job.id}`,
            at: job.createdAt || job.updatedAt,
            label: 'Assignment',
            icon: BriefcaseBusiness,
            variant: 'primary',
            text: `Assigned to “${job.title}”`,
          })),
        ...notifications.map((n) => ({
          key: `notif-${n.id}`,
          at: n.createdAt,
          label: 'Notification',
          icon: Bell,
          variant: 'warning',
          text: n.message,
        })),
        ...attendanceRecords.map((r) => ({
          key: `att-${r.id}`,
          at: r.createdAt || r.date,
          label: 'Attendance',
          icon: CalendarCheck,
          variant: 'success',
          text: `Attendance marked: ${r.status === 'PRESENT' ? 'Present' : r.status === 'HALF_DAY' ? 'Half day' : 'Absent'}`,
        })),
        ...salaryRecords.map((s, i) => ({
          key: `sal-${s.id ?? i}`,
          at: s.paymentDate || s.createdAt,
          label: 'Salary slip',
          icon: Wallet,
          variant: 'success',
          text: `Salary slip generated — ${formatWage(s.grossSalary)}`,
        })),
      ]
        .filter((a) => a.at != null)
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 5);

      setStats({
        period,
        openJobs: jobs.filter((job) => job.status === 'OPEN').length,
        appliedJobs: jobs.filter(
          (job) => String(job.workerId) === String(workerId)
        ).length,
        salaryThisMonth: salaryRecords[0]?.grossSalary ?? null,
        attendance: attendanceSummary,
        attendanceRecords,
        activeJob,
        activities,
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

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    /* No shell title for workers — the navbar role badge and each page's own
       heading carry that, so the banner is the first thing on the page. */
    <DashboardLayout showTitle={false}>
      {isOverview && (
        <div className="worker-dash">
          {/* Welcome banner */}
          <div className="card border-0 bg-primary text-white shadow-sm mb-4">
            <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <h5 className="card-title mb-1">
                  Welcome back, {titleCase(currentUser?.name)}!
                </h5>
                <p className="card-text text-teal-50 mb-0">
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

              {/* Metric cards */}
              <div className="row g-3">
                <StatCard
                  icon={Send}
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
                  icon={Wallet}
                  label="Salary this month"
                  value={
                    stats?.salaryThisMonth == null
                      ? formatWage(0)
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
                  icon={CalendarCheck}
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
                  icon={FolderOpen}
                  label="Open jobs available"
                  value={stats?.openJobs ?? '—'}
                  note="New opportunities are added regularly"
                  accent="info"
                />
              </div>

              {/* Today's schedule & recent activity */}
              <div className="row g-3 mt-1">
                {/* Schedule / active job */}
                <div className="col-lg-7">
                  <div className="card shadow-sm h-100">
                    <div className="card-header bg-white d-flex align-items-center justify-content-between gap-2">
                      <h4 className="h6 mb-0">
                        <CalendarDays size={16} className="me-2 text-primary" />
                        Today&apos;s Schedule &amp; Active Job
                      </h4>
                      <span className="text-muted small text-end">{todayLabel}</span>
                    </div>
                    <div className="card-body">
                      {stats?.activeJob ? (
                        <div>
                          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                            <h5 className="mb-0">{stats.activeJob.title}</h5>
                            <JobStatusBadge
                              status={stats.activeJob.status}
                              className="flex-shrink-0"
                            />
                          </div>
                          <div className="text-muted small mb-3">
                            <MapPin size={13} className="me-1" />
                            {stats.activeJob.location || 'Location not set'}
                          </div>
                          <div className="d-flex flex-wrap gap-3">
                            <div className="chip-wage">
                              {formatWage(stats.activeJob.wagePerDay)}
                              <span className="chip-wage-day">/day</span>
                            </div>
                            {stats.attendance && (
                              <div className="text-muted small align-self-center">
                                Today: {stats.attendance.presentDays ?? 0}/
                                {stats.attendance.totalDays ?? 0} days present
                                this month
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <BriefcaseBusiness
                            size={28}
                            className="text-muted mb-2"
                            strokeWidth={1.6}
                          />
                          <p className="mb-1 fw-semibold">No active job yet</p>
                          <p className="text-muted small mb-0">
                            Once an employer assigns you a job, it will show up
                            here with today&apos;s schedule.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent activity */}
                <div className="col-lg-5">
                  <div className="card shadow-sm h-100">
                    <div className="card-header bg-white">
                      <h4 className="h6 mb-0">
                        <Activity size={16} className="me-2 text-primary" />
                        Recent Activity
                      </h4>
                    </div>
                    <div className="card-body">
                      {stats?.activities?.length ? (
                        <ul className="list-unstyled mb-0">
                          {stats.activities.map((a) => {
                            const Icon = a.icon;
                            return (
                              <li
                                key={a.key}
                                className="d-flex align-items-start gap-3 py-2 border-bottom"
                              >
                                <span
                                  className={`stat-icon stat-icon-${a.variant} flex-shrink-0`}
                                  style={{ width: 34, height: 34, borderRadius: 10 }}
                                  aria-hidden="true"
                                >
                                  <Icon size={16} strokeWidth={2.2} />
                                </span>
                                <div className="flex-grow-1 min-w-0">
                                  <div className="small fw-semibold text-truncate">
                                    {a.text}
                                  </div>
                                  <div className="text-muted small d-flex align-items-center gap-1">
                                    <Clock size={11} />
                                    {dayLabel(a.at)}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="text-center py-4">
                          <Star
                            size={28}
                            className="text-muted mb-2"
                            strokeWidth={1.6}
                          />
                          <p className="mb-1 fw-semibold">Nothing yet</p>
                          <p className="text-muted small mb-0">
                            Job assignments, attendance marks and salary slips
                            will show up here as they happen.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
