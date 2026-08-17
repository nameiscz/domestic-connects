import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  Rectangle,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import axiosInstance from '../../api/axiosInstance';
import DashboardChart from '../../components/DashboardChart';
import type { BarShapeProps, PieSectorShapeProps } from 'recharts';
import type { DashboardAnalytics, Role } from '../../types';

// ---------------------------------------------------------------------------
// Chart config
// ---------------------------------------------------------------------------

/** Human-readable role labels + the fill color each role gets in the pie. */
const ROLE_LABEL: Partial<Record<Role, string>> = {
  ADMIN: 'Admins',
  EMPLOYER: 'Employers',
  WORKER: 'Workers',
};
const ROLE_COLOR: Partial<Record<Role, string>> = {
  ADMIN: '#dc3545',
  EMPLOYER: '#0d6efd',
  WORKER: '#198754',
};

/**
 * Backend treats OPEN + ASSIGNED as "active" and CLOSED as "inactive",
 * exposed as `activeJobs` / `inactiveJobs` on the analytics payload.
 */
const JOB_BARS: { key: 'activeJobs' | 'inactiveJobs'; name: string; color: string }[] = [
  { key: 'activeJobs', name: 'Active', color: '#198754' },
  { key: 'inactiveJobs', name: 'Inactive', color: '#6c757d' },
];

/** Fixed chart plot height so every card lines up (width stays fluid). */
const CHART_HEIGHT = 300;

/** Months offered in the selector, newest first. */
const MONTH_OPTIONS_COUNT = 12;

interface MonthOption {
  value: string;
  label: string;
}

/** "2026-08" -> "August 2026". */
const formatMonthLabel = (value: string): string => {
  const [year, monthIndex] = value.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

/** "YYYY-MM" for the current month. */
const currentMonthValue = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/** Last {@link MONTH_OPTIONS_COUNT} months as { value, label }, newest first. */
const buildMonthOptions = (): MonthOption[] => {
  const now = new Date();
  return Array.from({ length: MONTH_OPTIONS_COUNT }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: formatMonthLabel(value) };
  });
};

/**
 * Custom shapes replace the deprecated <Cell> pattern (recharts >= 3): each
 * datum carries its own `fill`, which the shape applies per slice/bar.
 * recharts attaches the datum as `payload` at runtime (not in the prop
 * types), hence the intersection with a minimal `payload` shape.
 */
const BarShape = (props: BarShapeProps & { payload?: { fill?: string } }) => {
  return (
    <Rectangle
      {...props}
      fill={props.payload?.fill}
      radius={[6, 6, 0, 0]}
    />
  );
};

const PieShape = (props: PieSectorShapeProps & { payload?: { fill?: string } }) => {
  return <Sector {...props} fill={props.payload?.fill} />;
};

/** usersByRole map -> recharts pie slices (zero-count roles dropped). */
const buildRoleData = (usersByRole: DashboardAnalytics['usersByRole'] = {}) =>
  Object.entries(usersByRole)
    .filter(([, count]) => count > 0)
    .map(([role, count]) => ({
      name: ROLE_LABEL[role as Role] || role,
      value: count,
      fill: ROLE_COLOR[role as Role] || '#adb5bd',
    }));

/** active/inactive job counts -> recharts bar series (null-safe). */
const buildJobData = (analytics: DashboardAnalytics | null = null) =>
  JOB_BARS.map(({ key, name, color }) => ({
    name,
    jobs: analytics?.[key] ?? 0,
    fill: color,
  }));

const formatRate = (value: number | null | undefined): string =>
  `${Number(value).toFixed(1)}%`;

/** Bootstrap bar variant for the attendance rate (traffic-light coloring). */
const rateBarClass = (rate: number | null | undefined): string => {
  if (rate == null || rate < 50) return 'bg-danger';
  if (rate >= 75) return 'bg-success';
  return 'bg-warning';
};

/** Read-only 5-star display driven by the average rating (1-5). */
function StarRating({ rating }: { rating: number | null | undefined }) {
  const filled = Math.round(rating ?? 0);
  return (
    <div className="mb-1" role="img" aria-label={`Rated ${Number(rating).toFixed(2)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`fs-3 lh-1 me-1 ${i < filled ? 'text-warning' : 'text-secondary'}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

/**
 * AdminAnalytics — platform KPIs from the admin-service aggregator
 * (GET /api/admin/dashboard/analytics, ApiResponse-wrapped). Downstream
 * failures resolve to zero/null server-side (circuit-breaker fallbacks), so a
 * missing slice renders as an empty state rather than an error.
 */
export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [month, setMonth] = useState(currentMonthValue);
  const monthOptions = buildMonthOptions();

  const loadAnalytics = useCallback(async (signal?: AbortSignal, selectedMonth?: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosInstance.get('/api/admin/dashboard/analytics', {
        params: { month: selectedMonth },
        signal,
      });
      setAnalytics(data?.data ?? null);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setError(
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Unable to load analytics. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAnalytics(controller.signal, month);
    return () => controller.abort();
  }, [loadAnalytics, refresh, month]);

  const roleData = buildRoleData(analytics?.usersByRole);
  const jobData = buildJobData(analytics);
  const attendanceRate = analytics?.monthlyAttendanceRate;
  const avgRating = analytics?.averagePerformanceRating;
  const totalReviews = analytics?.totalReviews;
  const totalJobs = jobData.reduce((sum, d) => sum + d.jobs, 0);

  return (
    <section aria-busy={loading}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">Analytics</h3>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <label className="visually-hidden" htmlFor="analytics-month">
            Analytics month
          </label>
          <select
            id="analytics-month"
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={loading}
          >
            {monthOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setRefresh((r) => r + 1)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
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
        <div className="row g-3">
          {/* Users by role */}
          <DashboardChart
            title="Users by role"
            emptyMessage={roleData.length === 0 ? 'No data yet.' : ''}
          >
            <div
              role="img"
              aria-label="Users by role chart"
              style={{ height: CHART_HEIGHT }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    shape={PieShape}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} user${value === 1 ? '' : 's'}`,
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashboardChart>

          {/* Active vs inactive jobs */}
          <DashboardChart
            title="Active vs inactive jobs"
            emptyMessage={totalJobs === 0 ? 'No data yet.' : ''}
          >
            <div
              role="img"
              aria-label="Active vs inactive jobs chart"
              style={{ height: CHART_HEIGHT }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={jobData}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tickLine={false}
                    axisLine={{ stroke: '#dee2e6' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} job${value === 1 ? '' : 's'}`,
                      name,
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="jobs"
                    name="Jobs"
                    maxBarSize={72}
                    shape={BarShape}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardChart>

          {/* This month's attendance rate */}
          <DashboardChart
            title="This month&apos;s attendance rate"
            emptyMessage={attendanceRate == null ? 'No attendance data yet.' : ''}
            bodyClassName="d-flex flex-column justify-content-center"
          >
            <div className="d-flex align-items-baseline justify-content-between mb-2">
              <span className="fs-1 fw-bold">{formatRate(attendanceRate)}</span>
              <span className="text-muted small">{formatMonthLabel(month)}</span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={attendanceRate ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="This month's attendance rate"
              style={{ height: 16 }}
            >
              <div
                className={`progress-bar ${rateBarClass(attendanceRate)}`}
                style={{ width: `${attendanceRate ?? 0}%` }}
              />
            </div>
          </DashboardChart>

          {/* Average performance rating */}
          <DashboardChart
            title="Average performance rating"
            emptyMessage={avgRating == null ? 'No ratings yet.' : ''}
            bodyClassName="d-flex flex-column justify-content-center"
          >
            <div className="fs-1 fw-bold text-warning">
              {Number(avgRating).toFixed(2)} / 5
            </div>
            <StarRating rating={avgRating} />
            <div className="text-muted small">
              {totalReviews == null
                ? 'Across workers'
                : `${totalReviews} review${totalReviews === 1 ? '' : 's'} across workers`}
            </div>
          </DashboardChart>
        </div>
      )}
    </section>
  );
}
