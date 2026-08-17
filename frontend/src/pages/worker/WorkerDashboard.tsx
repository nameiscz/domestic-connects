import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  Clock,
  FolderOpen,
  MapPin,
  Minus,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi, jobApi, notificationApi, payrollApi, performanceApi } from '../../api';
import { formatWage } from '../../utils/jobFormat';
import { Badge, Button, Card, CardHeader, Skeleton, ToastStack, useToast } from '../../components/ui';
import DashboardLayout from '../../components/DashboardLayout';
import type {
  Attendance,
  AttendanceSummary,
  JobPost,
  NotificationLog,
  SalaryRecord,
} from '../../types';

// ---------------------------------------------------------------------------
// Worker overview — a premium SaaS dashboard composed from independent,
// failure-tolerant calls (Promise.allSettled) so a single outage degrades to
// partial cards rather than a blank page:
//
//   • Jobs (open count, active assignment, recommendations) → jobApi.listJobs
//   • Salary history (6 months, for the earnings chart)     → payrollApi.getSalaryHistory
//   • Attendance history (6 months, trend + chart)          → attendanceApi.getWorkerAttendance
//   • Rating + reviews                                      → performanceApi.getWorkerPerformance
//   • Notifications inbox                                   → notificationApi.getNotifications
//
// Sections: hero (welcome + illustration + quick metrics + CTA), four trend
// stat cards, a calendar-style "Upcoming Schedule" card, a "Recent Activity"
// feed, attendance/earnings charts, and a Recommended Jobs widget. Every
// surface uses the --dc-* tokens so the whole dashboard adapts to dark mode.
// ---------------------------------------------------------------------------

type Trend = 'up' | 'down' | 'flat' | 'neutral';

interface TrendInfo {
  trend: Trend;
  label: string;
}

type ActivityVariant = 'primary' | 'success' | 'warning';

interface ActivityItem {
  key: string;
  at: string;
  label: string;
  icon: LucideIcon;
  variant: ActivityVariant;
  text: string;
}

interface WorkerStats {
  period: { month: number; year: number };
  openJobs: number;
  appliedJobs: number;
  newJobsThisWeek: number;
  salaryThisMonth: number | null;
  salaryLastMonth: number | null;
  attendance: AttendanceSummary | null;
  attendanceLastMonth: AttendanceSummary | null;
  attendanceRecords: Attendance[];
  activeJob: JobPost | null;
  avgRating: number | null;
  reviewCount: number;
  latestReviewRating: number | null;
  latestReviewer: string | null;
  /** One point per month, oldest → newest (for the charts). */
  attendanceTrend: { month: string; rate: number | null }[];
  earningsTrend: { month: string; earnings: number }[];
  recommendedJobs: JobPost[];
  activities: ActivityItem[];
}

const ACTIVITY_ICON: Record<ActivityVariant, string> = {
  primary: 'bg-teal-100 text-teal-700',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-marigold-100 text-marigold-600',
};

const dayLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startOf(today).getTime() - startOf(date).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const firstWord = (name = '') => name.trim().split(/\s+/)[0] || '';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d: Date) => {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const s = startOfDay(d);
  s.setDate(s.getDate() - day);
  return s;
};

/** Percentage of marked days the worker was present (null when none marked). */
const attendanceRate = (summary: AttendanceSummary | null): number | null => {
  if (!summary || !summary.totalDays) return null;
  return Math.round((summary.presentDays / summary.totalDays) * 100);
};

function salaryTrendInfo(cur: number | null, prev: number | null): TrendInfo {
  if (cur == null || cur === 0) return { trend: 'neutral', label: 'No payslip yet' };
  if (prev == null || prev === 0) return { trend: 'up', label: 'New this month' };
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return { trend: 'flat', label: 'Same as last month' };
  return {
    trend: pct > 0 ? 'up' : 'down',
    label: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs last month`,
  };
}

function attendanceTrendInfo(
  cur: AttendanceSummary | null,
  prev: AttendanceSummary | null
): TrendInfo {
  const curRate = attendanceRate(cur);
  const prevRate = attendanceRate(prev);
  if (curRate == null) return { trend: 'neutral', label: 'No records marked yet' };
  if (prevRate == null) return { trend: 'up', label: 'Tracking started' };
  const pts = curRate - prevRate;
  if (Math.abs(pts) < 1) return { trend: 'flat', label: 'Steady vs last month' };
  return {
    trend: pts > 0 ? 'up' : 'down',
    label: `${pts > 0 ? '+' : ''}${pts} pts vs last month`,
  };
}

function ratingTrendInfo(
  avg: number | null,
  latest: number | null,
  count: number
): TrendInfo {
  if (avg == null || count === 0) return { trend: 'neutral', label: 'No reviews yet' };
  if (latest == null) return { trend: 'flat', label: `${count} review${count === 1 ? '' : 's'}` };
  if (latest > avg + 0.05) return { trend: 'up', label: 'Improving' };
  if (latest < avg - 0.05) return { trend: 'down', label: 'Needs attention' };
  return { trend: 'flat', label: 'Steady' };
}

/** Compact directional chip for stat-card trends. */
function TrendChip({ trend, label }: TrendInfo) {
  const Icon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : trend === 'flat' ? Minus : Sparkles;
  const tint: Record<Trend, string> = {
    up: 'bg-success-soft text-success-text',
    down: 'bg-danger-soft text-danger-text',
    flat: 'bg-line/70 text-ink-soft',
    neutral: 'bg-teal-100/70 text-teal-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tint[trend]}`}
    >
      <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
      {label}
    </span>
  );
}

type StatAccent = 'primary' | 'success' | 'warning' | 'info';

const STAT_ACCENT: Record<StatAccent, string> = {
  primary: 'bg-teal-100 text-teal-700',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-marigold-100 text-marigold-600',
  info: 'bg-teal-100/60 text-teal-500',
};

/** Stat card — icon chip, big Fraunces metric, trend chip, supporting note. */
function PremiumStat({
  icon: Icon,
  label,
  value,
  note,
  trend,
  accent = 'primary',
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  trend?: TrendInfo;
  accent?: StatAccent;
}) {
  return (
    <div className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-card-hover">
      <div className="mb-4 flex items-start justify-between gap-2">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${STAT_ACCENT[accent]}`}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={2.2} />
        </span>
        {trend && <TrendChip {...trend} />}
      </div>
      <div className="font-display text-3xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </div>
      {note && <div className="mt-auto pt-2.5 text-sm text-ink-soft">{note}</div>}
    </div>
  );
}

/** Frosted-glass metric chip used inside the hero banner. */
function HeroMetric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="hero-metric">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
        <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
        {label}
      </div>
      <div className="truncate font-display text-lg font-bold text-white">{value}</div>
      {sub && <div className="truncate text-[11px] text-white/55">{sub}</div>}
    </div>
  );
}

/** Decorative glassy mini-cards on the hero's right side (real values). */
function HeroArt({
  earnings,
  rate,
  rating,
}: {
  earnings: string;
  rate: string;
  rating: string;
}) {
  return (
    <div className="relative hidden h-44 w-72 flex-none lg:block" aria-hidden="true">
      {/* Earnings mini-card */}
      <div className="absolute right-1 top-1 w-48 rotate-2 rounded-2xl border border-white/20 bg-white/10 p-3.5 shadow-card backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-marigold-400/90 text-teal-900">
            <Wallet size={16} strokeWidth={2.3} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
              Earnings
            </p>
            <p className="font-display text-base font-bold text-white">{earnings}</p>
          </div>
        </div>
        <p className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-success-soft/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
          <TrendingUp size={11} aria-hidden="true" />
          this month
        </p>
      </div>
      {/* Attendance ring */}
      <div className="absolute bottom-0 left-2 flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-card backdrop-blur-md">
        <p className="font-display text-xl font-bold leading-none text-white">{rate}</p>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-white/60">
          attendance
        </p>
      </div>
      {/* Rating chip */}
      <div className="absolute bottom-7 right-6 flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 shadow-card backdrop-blur-md">
        <Star size={13} className="fill-marigold-400 text-marigold-400" aria-hidden="true" />
        <span className="text-xs font-bold text-white">{rating}</span>
      </div>
      <span className="absolute right-24 top-0 h-3 w-3 rounded-full bg-marigold-400/80" />
      <span className="absolute bottom-14 left-16 h-2 w-2 rounded-full bg-teal-300/80" />
    </div>
  );
}

/** Calendar-style strip of the current week, today highlighted. */
function WeekStrip({ today, hasJob }: { today: Date; hasJob: boolean }) {
  const start = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-hidden="true">
      {days.map((d) => {
        const isToday = d.toDateString() === today.toDateString();
        const isPast = d.getTime() < startOfDay(today).getTime();
        return (
          <div
            key={d.toISOString()}
            className={[
              'relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center transition-colors',
              isToday
                ? 'border-teal-600 bg-teal-700 text-white shadow-glow'
                : 'border-line bg-canvas/60 text-ink',
              isPast && !isToday ? 'opacity-45' : '',
            ].join(' ')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {d.toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
            <span className="text-sm font-bold">{d.getDate()}</span>
            {hasJob && isToday && (
              <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-marigold-400" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Illustrated empty state — layered shapes + icon, keeps its premium feel. */
function DashEmptyState({
  kind,
  title,
  message,
  action,
}: {
  kind: 'job' | 'calendar' | 'activity' | 'chart';
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const Icon =
    kind === 'job' ? BriefcaseBusiness : kind === 'calendar' ? CalendarDays : kind === 'chart' ? TrendingUp : Sparkles;
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <div className="relative mb-5 h-24 w-24" aria-hidden="true">
        <div className="absolute inset-0 rotate-6 rounded-3xl bg-teal-100/80" />
        <div className="absolute inset-1.5 -rotate-3 rounded-2xl bg-white shadow-card" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon size={34} strokeWidth={1.7} className="text-teal-600" />
        </div>
        <span className="absolute -right-1 top-0 h-3.5 w-3.5 rounded-full bg-marigold-400 ring-2 ring-white" />
        <span className="absolute -left-1.5 bottom-2 h-2.5 w-2.5 rounded-full bg-teal-300" />
      </div>
      <h4 className="font-display text-base font-semibold text-ink">{title}</h4>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-soft">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const CHART_TOOLTIP_STYLE = {
  background: 'var(--dc-card)',
  border: '1px solid var(--dc-border)',
  borderRadius: 12,
  boxShadow: 'var(--dc-shadow-card)',
  color: 'var(--dc-ink)',
  fontSize: 12,
};

/** Attendance trend (6 months) — teal area chart. */
function AttendanceChart({ data }: { data: { month: string; rate: number | null }[] }) {
  const hasData = data.some((d) => d.rate != null);
  if (!hasData) {
    return (
      <DashEmptyState
        kind="chart"
        title="No attendance data yet"
        message="Once your employer starts marking attendance, your monthly rate trend will appear here."
      />
    );
  }
  return (
    <div className="h-52" aria-label="Attendance rate over the last 6 months">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--dc-teal-500)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--dc-teal-500)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--dc-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--dc-border)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            cursor={{ stroke: 'var(--dc-teal-500)', strokeDasharray: '3 3' }}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [`${value ?? '—'}%`, 'Attendance']}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--dc-teal-600)"
            strokeWidth={2.5}
            fill="url(#attendanceGradient)"
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Earnings overview (6 months) — teal bars. */
function EarningsChart({ data }: { data: { month: string; earnings: number }[] }) {
  const hasData = data.some((d) => d.earnings > 0);
  if (!hasData) {
    return (
      <DashEmptyState
        kind="chart"
        title="No earnings yet"
        message="Your monthly earnings will appear here once salary slips are generated."
      />
    );
  }
  return (
    <div className="h-52" aria-label="Earnings over the last 6 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--dc-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--dc-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            cursor={{ fill: 'var(--dc-teal-100)' }}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [formatWage(Number(value)), 'Earnings']}
          />
          <Bar dataKey="earnings" fill="var(--dc-teal-600)" radius={[6, 6, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function WorkerDashboard() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;
  const { pathname } = useLocation();
  const isOverview = pathname === '/worker' || pathname === '/worker/';

  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [partialFailure, setPartialFailure] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<number[]>([]);
  const { toasts, pushToast, dismissToast } = useToast();

  const fetchStats = useCallback(
    async (signal: AbortSignal) => {
      if (!workerId) return;
      setLoading(true);
      setPartialFailure(false);

      const now = new Date();
      const period = { month: now.getMonth() + 1, year: now.getFullYear() };
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevPeriod = { month: prevDate.getMonth() + 1, year: prevDate.getFullYear() };

      // Last 6 months (oldest → newest) for the trend charts.
      const sixMonths = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return {
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          label: d.toLocaleDateString('en-US', { month: 'short' }),
        };
      });

      // All calls are independent — fetch in parallel and let each card render
      // whatever made it back (a single outage shouldn't blank the page).
      const [
        jobsRes,
        payrollRes,
        payrollPrevRes,
        attendanceRes,
        attendancePrevRes,
        perfRes,
        notifRes,
        ...historyRes
      ] = await Promise.allSettled([
        jobApi.listJobs({ signal }),
        payrollApi.getSalaryHistory(workerId, period.month, period.year, { signal }),
        payrollApi.getSalaryHistory(workerId, prevPeriod.month, prevPeriod.year, { signal }),
        attendanceApi.getWorkerAttendance(workerId, period.month, period.year, { signal }),
        attendanceApi.getWorkerAttendance(workerId, prevPeriod.month, prevPeriod.year, { signal }),
        performanceApi.getWorkerPerformance(workerId, { signal }),
        notificationApi.getNotifications(workerId, { signal }),
        ...sixMonths.flatMap((m) => [
          attendanceApi.getWorkerAttendance(workerId, m.month, m.year, { signal }),
          payrollApi.getSalaryHistory(workerId, m.month, m.year, { signal }),
        ]),
      ]);

      // Ignore results after the request was aborted (unmount / navigation).
      if (signal.aborted) return;

      const results = [jobsRes, payrollRes, payrollPrevRes, attendanceRes, attendancePrevRes, perfRes, notifRes, ...historyRes];
      if (results.some((r) => r.status === 'rejected')) setPartialFailure(true);

      const jobs = jobsRes.status === 'fulfilled' && Array.isArray(jobsRes.value) ? jobsRes.value : [];
      const salaryRecords =
        payrollRes.status === 'fulfilled' && Array.isArray(payrollRes.value) ? payrollRes.value : [];
      const prevSalaryRecords =
        payrollPrevRes.status === 'fulfilled' && Array.isArray(payrollPrevRes.value)
          ? payrollPrevRes.value
          : [];
      const attendanceSummary = attendanceRes.status === 'fulfilled' ? attendanceRes.value?.summary ?? null : null;
      const prevAttendanceSummary =
        attendancePrevRes.status === 'fulfilled' ? attendancePrevRes.value?.summary ?? null : null;
      const attendanceRecords = Array.isArray(attendanceRes.status === 'fulfilled' ? attendanceRes.value?.records : [])
        ? (attendanceRes.status === 'fulfilled' ? attendanceRes.value?.records : [])
        : [];
      const performanceReport = perfRes.status === 'fulfilled' ? perfRes.value : null;
      const notifications =
        notifRes.status === 'fulfilled' && Array.isArray(notifRes.value) ? notifRes.value : [];

      // Month-by-month history for the charts (attendance then payroll, pairs).
      const monthSummaries = sixMonths.map((_, i) => {
        const res = historyRes[i * 2];
        if (res.status === 'fulfilled' && res.value && !Array.isArray(res.value)) {
          return res.value.summary ?? null;
        }
        return null;
      });
      const monthSalary = sixMonths.map((_, i) => {
        const res = historyRes[i * 2 + 1];
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          return res.value[0]?.grossSalary ?? 0;
        }
        return 0;
      });

      const assignedJobs = jobs.filter(
        (job) => job.status === 'ASSIGNED' && String(job.workerId) === String(workerId)
      );
      const activeJob = assignedJobs[0] ?? null;

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const reviews = Array.isArray(performanceReport?.reviews)
        ? [...performanceReport.reviews].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        : [];
      const latestReview = reviews[0] ?? null;

      // Recommended jobs: open, not assigned to me, newest first.
      const recommendedJobs = jobs
        .filter(
          (job) => job.status === 'OPEN' && String(job.workerId) !== String(workerId)
        )
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 3);

      // "Recent Activity" feed — merge events from every source, newest first.
      const activities: ActivityItem[] = [
        ...jobs
          .filter((job) => String(job.workerId) === String(workerId))
          .map((job) => ({
            key: `job-${job.id}`,
            at: job.createdAt,
            label: 'Assignment',
            icon: BriefcaseBusiness,
            variant: 'primary' as const,
            text: `Assigned to “${job.title}”`,
          })),
        ...notifications.map((n: NotificationLog) => ({
          key: `notif-${n.id}`,
          at: n.createdAt,
          label: 'Notification',
          icon: Bell,
          variant: 'warning' as const,
          text: n.message,
        })),
        ...attendanceRecords.map((r) => ({
          key: `att-${r.id}`,
          at: r.createdAt || r.date,
          label: 'Attendance',
          icon: CalendarCheck,
          variant: 'success' as const,
          text: `Attendance marked: ${r.status === 'PRESENT' ? 'Present' : r.status === 'HALF_DAY' ? 'Half day' : 'Absent'}`,
        })),
        ...salaryRecords.map((s: SalaryRecord, i) => ({
          key: `sal-${s.id ?? i}`,
          at: s.generatedAt,
          label: 'Salary slip',
          icon: Wallet,
          variant: 'success' as const,
          text: `Salary slip generated — ${formatWage(s.grossSalary)}`,
        })),
      ]
        .filter((a) => a.at != null)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 6);

      setStats({
        period,
        openJobs: jobs.filter((job) => job.status === 'OPEN').length,
        appliedJobs: jobs.filter((job) => String(job.workerId) === String(workerId)).length,
        newJobsThisWeek: jobs.filter(
          (job) => job.createdAt && new Date(job.createdAt).getTime() >= weekAgo
        ).length,
        salaryThisMonth: salaryRecords[0]?.grossSalary ?? null,
        salaryLastMonth: prevSalaryRecords[0]?.grossSalary ?? null,
        attendance: attendanceSummary,
        attendanceLastMonth: prevAttendanceSummary,
        attendanceRecords,
        activeJob,
        avgRating: performanceReport?.averageRating ?? null,
        reviewCount: performanceReport?.reviewCount ?? 0,
        latestReviewRating: latestReview?.rating ?? null,
        latestReviewer: latestReview?.reviewedBy ?? null,
        attendanceTrend: sixMonths.map((m, i) => ({
          month: m.label,
          rate: attendanceRate(monthSummaries[i]),
        })),
        earningsTrend: sixMonths.map((m, i) => ({ month: m.label, earnings: monthSalary[i] })),
        recommendedJobs,
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

  const handleApply = async (job: JobPost) => {
    if (!workerId || applyingId) return;
    setApplyingId(job.id);
    try {
      await jobApi.applyToJob(job.id);
      setAppliedJobIds((prev) => (prev.includes(job.id) ? prev : [...prev, job.id]));
      pushToast(`Application sent for "${job.title}" — the employer will review it.`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Unable to apply. Please try again.';
      pushToast(message, 'error');
    } finally {
      setApplyingId(null);
    }
  };

  const today = new Date();
  const periodLabel =
    stats?.period &&
    new Date(stats.period.year, stats.period.month - 1).toLocaleString('en-US', {
      month: 'long',
    }) +
      ` ${stats.period.year}`;
  const todayLabel = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const rate = attendanceRate(stats?.attendance ?? null);
  const earningsTrend = salaryTrendInfo(stats?.salaryThisMonth ?? null, stats?.salaryLastMonth ?? null);
  const attendanceTrend = attendanceTrendInfo(stats?.attendance ?? null, stats?.attendanceLastMonth ?? null);
  const ratingTrend = ratingTrendInfo(
    stats?.avgRating ?? null,
    stats?.latestReviewRating ?? null,
    stats?.reviewCount ?? 0
  );
  const jobsTrend: TrendInfo =
    (stats?.newJobsThisWeek ?? 0) > 0
      ? { trend: 'up', label: `${stats?.newJobsThisWeek} new this week` }
      : { trend: 'neutral', label: 'Live' };

  return (
    <DashboardLayout showTitle={false}>
      {isOverview && (
        <div className="worker-dash animate-fade-in space-y-6">
          <ToastStack toasts={toasts} onDismiss={dismissToast} />

          {!workerId ? (
            <Card className="py-10 text-center">
              <p className="mb-1 text-3xl" aria-hidden="true">
                👷
              </p>
              <h2 className="font-display text-lg font-semibold text-ink">
                Account not recognised
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                We couldn&apos;t identify your account. Please sign in again.
              </p>
            </Card>
          ) : loading ? (
            <WorkerDashboardSkeleton />
          ) : (
            <>
              {partialFailure && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-marigold-500/30 bg-marigold-100 px-4 py-2.5 text-sm text-marigold-600"
                  role="alert"
                >
                  <span aria-hidden="true">⚠️</span>
                  Some stats couldn&apos;t be loaded right now — the rest are shown below.
                </div>
              )}

              {/* ------------------------------------------------ Hero ---- */}
              <section className="dash-hero">
                <div className="dash-hero-content px-6 py-7 sm:px-8 sm:py-9">
                  <div className="flex items-start justify-between gap-6">
                    <div className="max-w-xl">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
                        <Sparkles size={12} aria-hidden="true" />
                        Worker dashboard
                      </span>
                      <h1 className="mt-3 font-display text-2xl font-bold leading-snug text-white sm:text-3xl">
                        Welcome back, {firstWord(currentUser?.name)}! 👋
                      </h1>
                      <p className="mt-1.5 max-w-lg text-sm text-white/70 sm:text-base">
                        Find jobs, track attendance, manage earnings and grow your profile.
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Link
                          to="/worker/jobs"
                          className="hero-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
                        >
                          Browse Jobs
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link
                          to="/worker/performance"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                        >
                          <Star size={15} aria-hidden="true" />
                          View Performance
                        </Link>
                      </div>
                    </div>

                    <HeroArt
                      earnings={formatWage(stats?.salaryThisMonth ?? 0)}
                      rate={rate != null ? `${rate}%` : '—'}
                      rating={stats?.avgRating != null ? Number(stats.avgRating).toFixed(1) : '—'}
                    />
                  </div>

                  {/* Quick metrics — compact glass strip */}
                  <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    <HeroMetric
                      icon={BriefcaseBusiness}
                      label="Active job"
                      value={stats?.activeJob ? 'Active' : 'None yet'}
                      sub={stats?.activeJob ? stats.activeJob.title : 'Browse jobs to apply'}
                    />
                    <HeroMetric
                      icon={Wallet}
                      label="Earnings"
                      value={formatWage(stats?.salaryThisMonth ?? 0)}
                      sub={stats?.salaryThisMonth != null ? 'this month' : 'No payslip yet'}
                    />
                    <HeroMetric
                      icon={CalendarCheck}
                      label="Attendance"
                      value={rate != null ? `${rate}%` : '—'}
                      sub={rate != null ? 'this month' : 'Not tracked yet'}
                    />
                    <HeroMetric
                      icon={Star}
                      label="Rating"
                      value={stats?.avgRating != null ? `${Number(stats.avgRating).toFixed(1)} ★` : '—'}
                      sub={
                        stats?.reviewCount
                          ? `${stats.reviewCount} review${stats.reviewCount === 1 ? '' : 's'}`
                          : 'No reviews yet'
                      }
                    />
                  </div>
                </div>
              </section>

              {/* ------------------------------------------- Stat cards ---- */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <PremiumStat
                  icon={Wallet}
                  label="Earnings this month"
                  value={formatWage(stats?.salaryThisMonth ?? 0)}
                  note={stats?.salaryThisMonth != null ? periodLabel : 'No payslip generated yet'}
                  trend={earningsTrend}
                  accent="success"
                />
                <PremiumStat
                  icon={CalendarCheck}
                  label="Attendance rate"
                  value={rate != null ? `${rate}%` : '—'}
                  note={
                    stats?.attendance
                      ? `${stats.attendance.presentDays ?? 0}/${stats.attendance.totalDays ?? 0} days present`
                      : 'No records marked yet'
                  }
                  trend={attendanceTrend}
                  accent="warning"
                />
                <PremiumStat
                  icon={FolderOpen}
                  label="Active jobs"
                  value={stats?.openJobs ?? '—'}
                  note={
                    stats?.appliedJobs
                      ? `${stats.appliedJobs} applied so far`
                      : 'New opportunities added regularly'
                  }
                  trend={jobsTrend}
                  accent="info"
                />
                <PremiumStat
                  icon={Star}
                  label="Performance rating"
                  value={stats?.avgRating != null ? `${Number(stats.avgRating).toFixed(1)} / 5` : '—'}
                  note={
                    stats?.reviewCount
                      ? `From ${stats.reviewCount} review${stats.reviewCount === 1 ? '' : 's'}`
                      : 'No reviews yet'
                  }
                  trend={ratingTrend}
                  accent="warning"
                />
              </div>

              {/* --------------------------- Schedule + activity ---- */}
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Upcoming schedule — calendar style */}
                <Card className="lg:col-span-7">
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-teal-700" aria-hidden="true" />
                        Upcoming Schedule
                      </span>
                    }
                    subtitle={todayLabel}
                  />
                  <WeekStrip today={today} hasJob={Boolean(stats?.activeJob)} />

                  {stats?.activeJob ? (
                    <div className="mt-5 rounded-2xl border border-line bg-canvas/60 p-4 sm:p-5">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-display text-lg font-semibold text-ink">
                          {stats.activeJob.title}
                        </h3>
                        <Badge variant="success">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                          Assigned
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} aria-hidden="true" />
                          {stats.activeJob.location || 'Location not set'}
                        </span>                          <span className="inline-flex items-baseline gap-1 rounded-full bg-teal-100 px-3 py-1 font-display text-base font-bold text-teal-700">
                          {formatWage(stats.activeJob.wagePerDay)}
                          <span className="font-sans text-xs font-semibold text-teal-700">/day</span>
                        </span>
                      </div>

                      <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-teal-100 text-teal-700" aria-hidden="true">
                            <Building2 size={16} />
                          </span>
                          <div className="min-w-0">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                              Employer
                            </dt>
                            <dd className="truncate text-sm font-semibold text-ink">
                              {stats.latestReviewer || `Employer #${stats.activeJob.employerId}`}
                            </dd>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-marigold-100 text-marigold-600" aria-hidden="true">
                            <Clock size={16} />
                          </span>
                          <div className="min-w-0">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                              Working since
                            </dt>
                            <dd className="truncate text-sm font-semibold text-ink">
                              {dayLabel(stats.activeJob.createdAt)}
                            </dd>
                          </div>
                        </div>
                      </dl>

                      {stats.attendance && stats.attendance.totalDays === 0 && (
                        <p className="mt-4 rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 text-xs text-ink-soft">
                          Your attendance records will appear here once your employer starts
                          tracking attendance.
                        </p>
                      )}
                    </div>
                  ) : (
                    <DashEmptyState
                      kind="job"
                      title="No active job yet"
                      message="Once an employer assigns you a job, your shifts and employer details will appear here."
                      action={
                        <Link to="/worker/jobs">
                          <Button size="sm">
                            <BriefcaseBusiness size={15} aria-hidden="true" />
                            Browse Jobs
                          </Button>
                        </Link>
                      }
                    />
                  )}
                </Card>

                {/* Recent activity */}
                <Card className="lg:col-span-5">
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <Activity size={16} className="text-teal-700" aria-hidden="true" />
                        Recent Activity
                      </span>
                    }
                  />
                  {stats?.activities.length ? (
                    <ul className="space-y-0">
                      {stats.activities.map((a) => {
                        const Icon = a.icon;
                        return (
                          <li
                            key={a.key}
                            className="group flex items-start gap-3 border-b border-line py-3 last:border-b-0"
                          >
                            <span
                              className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${ACTIVITY_ICON[a.variant]}`}
                              aria-hidden="true"
                            >
                              <Icon size={16} strokeWidth={2.2} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-ink">
                                {a.text}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
                                <span className="font-medium uppercase tracking-wide">
                                  {a.label}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock size={11} aria-hidden="true" />
                                  {dayLabel(a.at)}
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <DashEmptyState
                      kind="activity"
                      title="Nothing yet"
                      message="Job assignments, attendance marks and salary slips will show up here as they happen."
                    />
                  )}
                </Card>
              </div>

              {/* --------------------------------- Charts (6 months) ---- */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <CalendarCheck size={16} className="text-teal-700" aria-hidden="true" />
                        Attendance Trend
                      </span>
                    }
                    subtitle="Last 6 months"
                  />
                  {stats && <AttendanceChart data={stats.attendanceTrend} />}
                </Card>
                <Card>
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <Wallet size={16} className="text-teal-700" aria-hidden="true" />
                        Earnings Overview
                      </span>
                    }
                    subtitle="Last 6 months"
                  />
                  {stats && <EarningsChart data={stats.earningsTrend} />}
                </Card>
              </div>

              {/* ------------------------------------ Recommended jobs ---- */}
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <BriefcaseBusiness size={16} className="text-teal-700" aria-hidden="true" />
                      Recommended Jobs
                    </span>
                  }
                  subtitle="Open roles you could apply to"
                  action={
                    <Link
                      to="/worker/jobs"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-500"
                    >
                      View all
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  }
                />
                {stats?.recommendedJobs.length ? (
                  <ul className="divide-y divide-line">
                    {stats.recommendedJobs.map((job) => {
                      const applied = appliedJobIds.includes(job.id);
                      return (
                        <li
                          key={job.id}
                          className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                              <Badge variant="success">Open</Badge>
                            </div>
                            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} aria-hidden="true" />
                                {job.location || '—'}
                              </span>
                              <span className="font-semibold text-teal-700">
                                {formatWage(job.wagePerDay)}
                                <span className="text-ink-soft">/day</span>
                              </span>
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleApply(job)}
                            disabled={Boolean(applyingId) || applied}
                            isLoading={applyingId === job.id}
                          >
                            {applied ? 'Applied' : 'Apply'}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <DashEmptyState
                    kind="job"
                    title="No open jobs right now"
                    message="New opportunities are added regularly — check the Jobs page soon."
                    action={
                      <Link to="/worker/jobs">
                        <Button size="sm" variant="secondary">
                          Browse Jobs
                        </Button>
                      </Link>
                    }
                  />
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

/** Loading skeleton matching the dashboard's final layout. */
function WorkerDashboardSkeleton() {
  return (
    <div data-testid="worker-dashboard-loading" className="space-y-6" aria-busy="true">
      {/* Hero */}
      <div className="rounded-2xl bg-teal-900/90 p-7 sm:p-9">
        <Skeleton className="h-4 w-32 rounded-full bg-white/20" />
        <Skeleton className="mt-4 h-8 w-72 bg-white/20" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full bg-white/20" />
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
      {/* Schedule + activity */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <Skeleton className="mb-2 h-5 w-56" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mt-5 h-40 w-full rounded-2xl" />
        </Card>
        <Card className="lg:col-span-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <ActivitySkeleton />
          <ActivitySkeleton />
        </Card>
      </div>
      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i}>
            <Skeleton className="mb-4 h-5 w-44" />
            <Skeleton className="h-52 w-full rounded-2xl" />
          </Card>
        ))}
      </div>
      {/* Recommended jobs */}
      <Card>
        <Skeleton className="mb-4 h-5 w-48" />
        <Skeleton className="mb-3 h-12 w-full" />
        <Skeleton className="mb-3 h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    </div>
  );
}

/** Skeleton rows matching the activity-feed list layout. */
function ActivitySkeleton() {
  return (
    <div className="mb-3 flex items-center gap-3" aria-hidden="true">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="mb-1.5 h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
