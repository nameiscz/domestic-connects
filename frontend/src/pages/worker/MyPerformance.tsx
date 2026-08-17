import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  BarChart3,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Medal,
  MessageSquareText,
  ShieldCheck,
  Star,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi, jobApi, performanceApi } from '../../api';
import { formatDate } from '../../utils/jobFormat';
import { Badge, Card, CardHeader, Skeleton } from '../../components/ui';
import type { PerformanceReview, WorkerPerformanceReport } from '../../types';

const STAR_COUNT = 5;
const PAGE_SIZE = 10;

const CHART_TOOLTIP_STYLE = {
  background: 'var(--dc-card)',
  border: '1px solid var(--dc-border)',
  borderRadius: 12,
  boxShadow: 'var(--dc-shadow-card)',
  color: 'var(--dc-ink)',
  fontSize: 12,
};

const DIST_COLORS = ['#64748B', '#94A3B8', '#F2A93B', '#10B981', '#0F766E'];

/** Renders a 1–5 star row (filled ★ for the rating, dim ☆ for the rest). */
function Stars({ rating }: { rating: number | null }) {
  const value = Math.round(Number(rating) || 0);
  return (
    <span
      className="text-marigold-500"
      role="img"
      aria-label={`${value} out of ${STAR_COUNT} stars`}
    >
      {'★'.repeat(Math.min(Math.max(value, 0), STAR_COUNT))}
      {'☆'.repeat(Math.max(STAR_COUNT - value, 0))}
    </span>
  );
}

/** Deterministic employer avatar — initials on a teal/marigold gradient. */
function EmployerAvatar({ reviewer, id }: { reviewer: string; id: number }) {
  const initials = (reviewer || `E${id}`)
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hue = 160 + ((id * 53) % 70);
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 42% 34%), hsl(${hue + 26} 45% 22%))` }}
    >
      {initials || 'E'}
    </span>
  );
}

interface Achievement {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  earned: boolean;
}

/** Illustrated empty state — layered trophy shape. */
function PerformanceEmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <div className="relative mb-6 h-28 w-28" aria-hidden="true">
        <div className="absolute inset-0 rotate-6 rounded-3xl bg-marigold-100/80" />
        <div className="absolute inset-1.5 -rotate-3 rounded-2xl bg-white shadow-card" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Trophy size={40} strokeWidth={1.6} className="text-marigold-500" />
        </div>
        <span className="absolute -right-1 top-0 h-4 w-4 rounded-full bg-teal-400 ring-2 ring-white" />
        <span className="absolute -left-1.5 bottom-2 h-3 w-3 rounded-full bg-marigold-300" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink">No reviews yet</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
        Complete jobs and receive reviews to build your reputation.
      </p>
    </div>
  );
}

/**
 * MyPerformance — the worker's performance dashboard. Top metrics (average
 * rating, total reviews, completed jobs, employer satisfaction), rating trend
 * + distribution charts, achievement badges, and review cards with employer
 * avatars. Fetched via GET /api/performance/worker/{id}/history?page=&size=,
 * plus best-effort job/attendance calls for the extra metrics.
 */
export default function MyPerformance() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;

  const [report, setReport] = useState<WorkerPerformanceReport | null>(null);
  const [loading, setLoading] = useState(Boolean(workerId));
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);

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
        const data = await performanceApi.getWorkerHistory(workerId, page, PAGE_SIZE, {
          signal: controller.signal,
        });
        setReport(data);

        // Best-effort extras: completed jobs + attendance rate (for badges).
        const now = new Date();
        const period = { month: now.getMonth() + 1, year: now.getFullYear() };
        const [jobsRes, attRes] = await Promise.allSettled([
          jobApi.listJobs({ signal: controller.signal }),
          attendanceApi.getWorkerAttendance(workerId, period.month, period.year, {
            signal: controller.signal,
          }),
        ]);
        if (controller.signal.aborted) return;
        if (jobsRes.status === 'fulfilled' && Array.isArray(jobsRes.value)) {
          setCompletedJobs(
            jobsRes.value.filter(
              (job) => job.status === 'ASSIGNED' && String(job.workerId) === String(workerId)
            ).length
          );
        }
        if (attRes.status === 'fulfilled' && attRes.value?.summary?.totalDays) {
          setAttendanceRate(
            Math.round(
              (attRes.value.summary.presentDays / attRes.value.summary.totalDays) * 100
            )
          );
        }
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load your performance reviews.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [workerId, page, refresh]);

  const reviews = report?.reviews ?? [];
  const distribution = report?.ratingDistribution ?? [];

  // Derived metrics.
  const employerSatisfaction = useMemo(() => {
    const all = report?.ratingDistribution ?? [];
    const total = all.reduce((s, b) => s + b.count, 0);
    const positive = all.filter((b) => b.rating >= 4).reduce((s, b) => s + b.count, 0);
    return total > 0 ? Math.round((positive / total) * 100) : null;
  }, [report]);

  // Rating trend — average rating per month (chronological).
  const ratingTrend = useMemo(() => {
    const byMonth = new Map<string, { sum: number; count: number }>();
    for (const r of report?.reviews ?? []) {
      const d = new Date(r.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = byMonth.get(key) ?? { sum: 0, count: 0 };
      b.sum += r.rating;
      b.count += 1;
      byMonth.set(key, b);
    }
    return [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, b]) => ({
        month: new Date(Number(key.slice(0, 4)), Number(key.slice(5)), 1).toLocaleDateString(
          'en-US',
          { month: 'short' }
        ),
        rating: Number((b.sum / b.count).toFixed(2)),
      }));
  }, [report]);

  // Achievements from real data.
  const achievements = useMemo<Achievement[]>(() => {
    const avg = report?.averageRating ?? null;
    const count = report?.reviewCount ?? 0;
    return [
      {
        key: 'reliable',
        icon: ShieldCheck,
        title: 'Reliable Worker',
        description: 'Average rating of 4.5★ or higher',
        earned: avg != null && avg >= 4.5,
      },
      {
        key: 'attendance',
        icon: BadgeCheck,
        title: 'Perfect Attendance',
        description: '100% attendance this month',
        earned: attendanceRate != null && attendanceRate === 100,
      },
      {
        key: 'top-rated',
        icon: Award,
        title: 'Top Rated Worker',
        description: '5-star reviews from employers',
        earned: count > 0 && (report?.reviews ?? []).some((r) => r.rating === 5),
      },
    ];
  }, [report, attendanceRate]);

  const firstOnPage = reviews.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastOnPage = reviews.length === 0 ? 0 : page * PAGE_SIZE + reviews.length;
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <section aria-busy={loading}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-2xl font-semibold text-ink">Performance</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            Reviews submitted by your employers
          </p>
        </div>
      </div>

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
        <div data-testid="performance-loading" className="space-y-4" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-32 rounded-2xl border border-line bg-white p-5 shadow-card">
                <Skeleton className="mb-3 h-11 w-11 rounded-xl" />
                <Skeleton className="mb-2 h-8 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="border-danger/30 bg-danger-soft/40">
          <h4 className="font-display text-base font-semibold text-ink">
            Couldn&apos;t load your performance
          </h4>
          <p className="mt-1 text-sm text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={() => setRefresh((r) => r + 1)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700 active:bg-teal-100/50"
          >
            Try again
          </button>
        </Card>
      ) : reviews.length === 0 ? (
        <Card>
          <PerformanceEmptyState />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Top metrics */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-marigold-100 text-marigold-600" aria-hidden="true">
                <Star size={20} strokeWidth={2.2} />
              </span>
              <div className="font-display text-3xl font-bold leading-tight text-ink">
                {report?.averageRating == null ? '—' : Number(report.averageRating).toFixed(1)}
                <span className="ml-1 text-sm font-medium text-ink-soft">/ 5</span>
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Average rating
              </div>
              <p className="mt-auto pt-2 text-sm text-ink-soft">
                {report?.averageRating == null
                  ? 'No ratings yet'
                  : `Across ${report.reviewCount} review${report.reviewCount === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700" aria-hidden="true">
                <MessageSquareText size={20} strokeWidth={2.2} />
              </span>
              <div className="font-display text-3xl font-bold leading-tight text-ink">
                {report?.reviewCount ?? 0}
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Total reviews
              </div>
              <p className="mt-auto pt-2 text-sm text-ink-soft">Submitted by your employers</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-success-soft text-success-text" aria-hidden="true">
                <Briefcase size={20} strokeWidth={2.2} />
              </span>
              <div className="font-display text-3xl font-bold leading-tight text-ink">
                {completedJobs}
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Completed jobs
              </div>
              <p className="mt-auto pt-2 text-sm text-ink-soft">Jobs you&apos;re assigned to</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-marigold-100 text-marigold-600" aria-hidden="true">
                <Handshake size={20} strokeWidth={2.2} />
              </span>
              <div className="font-display text-3xl font-bold leading-tight text-ink">
                {employerSatisfaction == null ? '—' : `${employerSatisfaction}%`}
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Employer satisfaction
              </div>
              <p className="mt-auto pt-2 text-sm text-ink-soft">Share of 4–5★ reviews</p>
            </div>
          </div>

          {/* Analytics charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-teal-700" aria-hidden="true" />
                    Rating trend
                  </span>
                }
                subtitle="Average rating over time"
              />
              <div className="h-56" aria-label="Rating trend over time">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ratingTrend}
                    margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--dc-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--dc-border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 5]}
                      tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: 'var(--dc-marigold-500)', strokeDasharray: '3 3' }}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value) => [`${value} / 5`, 'Average rating']}
                    />
                    <Line
                      type="monotone"
                      dataKey="rating"
                      stroke="var(--dc-marigold-500)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: 'var(--dc-marigold-500)' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-teal-700" aria-hidden="true" />
                    Review distribution
                  </span>
                }
                subtitle="Ratings given across all reviews"
              />
              <div className="h-56" aria-label="Review rating distribution">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={distribution}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--dc-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="rating"
                      tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--dc-border)' }}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}★`}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--dc-teal-100)' }}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value, _name, item) => [`${value} review${Number(value) === 1 ? '' : 's'}`, `${item?.payload?.rating}★`]}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={38}>
                      {distribution.map((bucket) => (
                        <Cell
                          key={bucket.rating}
                          fill={DIST_COLORS[bucket.rating - 1] ?? '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Achievements */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Medal size={16} className="text-teal-700" aria-hidden="true" />
                  Achievements
                </span>
              }
              subtitle={`${earnedCount} of ${achievements.length} earned`}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {achievements.map((a) => {
                const Icon = a.icon;
                return (
                  <div
                    key={a.key}
                    data-testid={`achievement-${a.key}`}
                    className={[
                      'flex flex-col items-center rounded-2xl border p-5 text-center transition-all duration-150',
                      a.earned
                        ? 'border-marigold-500/40 bg-marigold-100/60 shadow-card'
                        : 'border-line bg-canvas/40 opacity-70',
                    ].join(' ')}
                  >
                    <span
                      className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                        a.earned
                          ? 'bg-marigold-500 text-white'
                          : 'bg-line/60 text-ink-soft'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon size={22} />
                    </span>
                    <h5 className="font-display text-sm font-semibold text-ink">{a.title}</h5>
                    <p className="mt-1 text-xs text-ink-soft">{a.description}</p>
                    <Badge
                      variant={a.earned ? 'success' : 'neutral'}
                      className="mt-3"
                    >
                      {a.earned ? 'Earned' : 'Locked'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Review history — cards */}
          <Card flush>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
              <h4 className="font-display text-lg font-semibold text-ink">Review history</h4>
              <span className="text-sm text-ink-soft">
                Showing {firstOnPage}–{lastOnPage} of {report?.totalElements}
              </span>
            </div>
            <div className="divide-y divide-line">
              {reviews.map((review: PerformanceReview) => (
                <div
                  key={review.id}
                  data-testid="review-card"
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-canvas/50 sm:flex-row sm:items-start"
                >
                  <EmployerAvatar reviewer={review.reviewedBy} id={review.jobId} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">
                        {review.reviewedBy || 'Employer'}
                      </span>
                      <Badge variant="neutral">Job #{review.jobId ?? '—'}</Badge>
                      <span className="flex items-center gap-1 text-xs text-ink-soft">
                        <Building2 size={12} aria-hidden="true" />
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Stars rating={review.rating} />
                      <span className="ml-1.5 text-xs text-ink-soft">({review.rating}/5)</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      {review.remarks || 'No comment left.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center border-t border-line bg-canvas/40 px-5 py-3">
              <nav aria-label="Review history pages" className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                  Previous
                </button>
                <Badge variant="neutral" className="px-3 py-1.5">
                  Page {page + 1} of {report?.totalPages}
                </Badge>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min((report?.totalPages ?? 1) - 1, p + 1))}
                  disabled={page + 1 >= (report?.totalPages ?? 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </nav>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
