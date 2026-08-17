import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Banknote,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardList,
  Handshake,
  MapPin,
  Minus,
  Plus,
  Rocket,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi, jobApi, performanceApi } from '../../api';
import { formatDate, formatWage } from '../../utils/jobFormat';
import { Card, CardHeader, Skeleton } from '../../components/ui';
import JobStatusBadge from '../../components/JobStatusBadge';
import DashboardLayout from '../../components/DashboardLayout';
import type { JobPost, User } from '../../types';

// ---------------------------------------------------------------------------
// Employer overview — a premium SaaS dashboard. Summary cards derived from
// jobApi.listJobs (filtered to the signed-in employer), per-worker performance
// reports (GET /api/performance/worker/{id}), and best-effort application
// counts per open posting. Includes a glassmorphism hero with quick metrics,
// trend stat cards, quick actions, recent postings, and the per-worker rating
// breakdown.
// ---------------------------------------------------------------------------

/** Renders a 1–5 star row (filled ★ for the rating, dim ☆ for the rest). */
function Stars({ rating }: { rating: number | string }) {
  const value = Math.round(Number(rating) || 0);
  return (
    <span
      className="text-marigold-500"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {'★'.repeat(Math.min(Math.max(value, 0), 5))}
      {'☆'.repeat(Math.max(5 - value, 0))}
    </span>
  );
}

/** Deterministic worker avatar — initials on a teal gradient. */
function WorkerAvatar({ name, id }: { name: string; id: string }) {
  const initials = (name || `W${id}`)
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hue = 160 + ((Number(id) * 47) % 60);
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-xs font-bold text-white"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 42% 34%), hsl(${hue + 24} 45% 24%))` }}
    >
      {initials || 'W'}
    </span>
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

type Trend = 'up' | 'down' | 'flat' | 'neutral';

interface TrendInfo {
  trend: Trend;
  label: string;
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

/** Stat card — icon chip, big metric, trend chip, supporting note. */
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

interface BreakdownEntry {
  workerId: string;
  name: string;
  averageRating: number | null;
  reviewCount: number;
  unavailable: boolean;
}

interface EmployerStats {
  total: number;
  open: number;
  hired: number;
  avgWage: number | null;
  perfAvg: number | null;
  perfReviews: number;
  perfWorkers: number;
  breakdown: BreakdownEntry[];
  pendingApplications: number;
  recentJobs: JobPost[];
}

export default function EmployerDashboard() {
  const { currentUser } = useAuth();
  const employerId = currentUser?.id;
  const { pathname } = useLocation();
  const isOverview = pathname === '/employer' || pathname === '/employer/';

  const [stats, setStats] = useState<EmployerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        // Jobs and the worker directory load in parallel; a failing worker
        // list degrades to empty (names fall back to "Worker #id").
        const [jobs, workers] = await Promise.all([
          jobApi.listJobs({ signal }),
          authApi.getWorkers({ signal }).catch(() => [] as User[]),
        ]);
        const mine = (Array.isArray(jobs) ? jobs : []).filter(
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

        // Best-effort pending-application count across OPEN postings.
        const appResults = await Promise.allSettled(
          open.map((job) => jobApi.getApplications(job.id, { signal }))
        );
        const pendingApplications = appResults.reduce(
          (sum, result) =>
            sum +
            (result.status === 'fulfilled'
              ? (Array.isArray(result.value) ? result.value : []).filter(
                  (a) => a.status === 'PENDING'
                ).length
              : 0),
          0
        );

        // Resolve worker names from the auth directory.
        const workerNameById = new Map(
          (Array.isArray(workers) ? workers : [])
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
              .filter((id): id is number => id != null)
              .map(String)
          ),
        ];
        const results = await Promise.allSettled(
          workerIds.map((id) => performanceApi.getWorkerPerformance(Number(id), { signal }))
        );

        let ratingSum = 0;
        let ratedWorkers = 0;
        let perfReviews = 0;
        const breakdown: BreakdownEntry[] = results.map((result, index) => {
          const report = result.status === 'fulfilled' ? result.value : null;
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

        const recentJobs = [...mine]
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
          .slice(0, 3);

        setStats({
          total: mine.length,
          open: open.length,
          hired: assigned.length,
          avgWage,
          perfAvg: ratedWorkers === 0 ? null : ratingSum / ratedWorkers,
          perfReviews,
          perfWorkers: workerIds.length,
          breakdown,
          pendingApplications,
          recentJobs,
        });
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load your dashboard.'
          );
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

  const firstWord = (name = '') => name.trim().split(/\s+/)[0] || '';

  // Trend chips from real data.
  const postsTrend: TrendInfo =
    (stats?.open ?? 0) > 0
      ? { trend: 'up', label: `${stats?.open} open now` }
      : { trend: 'neutral', label: 'No open posts' };
  const hiredTrend: TrendInfo =
    (stats?.hired ?? 0) > 0
      ? { trend: 'up', label: `${stats?.hired} assigned` }
      : { trend: 'neutral', label: 'Assign a worker' };
  const ratingTrend: TrendInfo =
    stats?.perfAvg == null
      ? { trend: 'neutral', label: 'No reviews yet' }
      : stats.perfAvg >= 4
        ? { trend: 'up', label: 'Strong team' }
        : { trend: 'flat', label: 'Needs attention' };

  const actions = useMemo(
    () => [
      {
        to: '/employer/jobs/new',
        icon: Plus,
        title: 'Post a job',
        description: 'Create a new opening for workers',
        tint: 'bg-teal-100 text-teal-700',
      },
      {
        to: '/employer/attendance',
        icon: CalendarCheck,
        title: 'Mark attendance',
        description: 'Record daily attendance for your workers',
        tint: 'bg-success-soft text-success-text',
      },
      {
        to: '/employer/jobs',
        icon: ClipboardList,
        title: 'Review applicants',
        description:
          stats && stats.pendingApplications > 0
            ? `${stats.pendingApplications} application${stats.pendingApplications === 1 ? '' : 's'} awaiting review`
            : 'Manage your job posts and applications',
        tint: 'bg-marigold-100 text-marigold-600',
      },
    ],
    [stats]
  );

  return (
    <DashboardLayout title="Employer Dashboard" accent="success">
      {isOverview && (
        <div className="animate-fade-in space-y-6">
          {/* ------------------------------------------------ Hero ---- */}
          {!loading && !error && employerId && (
            <section className="dash-hero">
              <div className="dash-hero-content px-6 py-7 sm:px-8 sm:py-9">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="max-w-xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
                      <Sparkles size={12} aria-hidden="true" />
                      Employer dashboard
                    </span>
                    <h1 className="mt-3 font-display text-2xl font-bold leading-snug text-white sm:text-3xl">
                      Welcome back, {firstWord(currentUser?.name)}! 👋
                    </h1>
                    <p className="mt-1.5 max-w-lg text-sm text-white/70 sm:text-base">
                      Post openings, review applicants and keep your team on
                      track — all from one place.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Link
                        to="/employer/jobs/new"
                        className="hero-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
                      >
                        <Plus size={16} aria-hidden="true" />
                        Post a job
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                      <Link
                        to="/employer/jobs"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                      >
                        <Briefcase size={15} aria-hidden="true" />
                        View my posts
                      </Link>
                    </div>
                  </div>

                  {/* Decorative glassy mini-cards */}
                  <div className="relative hidden h-44 w-72 flex-none lg:block" aria-hidden="true">
                    <div className="absolute right-1 top-1 w-48 rotate-2 rounded-2xl border border-white/20 bg-white/10 p-3.5 shadow-card backdrop-blur-md">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-marigold-400/90 text-teal-900">
                          <Rocket size={16} strokeWidth={2.3} />
                        </span>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
                            Open jobs
                          </p>
                          <p className="font-display text-base font-bold text-white">
                            {stats?.open ?? 0}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-success-soft/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                        <TrendingUp size={11} aria-hidden="true" />
                        {stats && stats.pendingApplications > 0
                          ? `${stats.pendingApplications} pending applications`
                          : 'ready for applicants'}
                      </p>
                    </div>
                    <div className="absolute bottom-0 left-2 flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-card backdrop-blur-md">
                      <p className="font-display text-xl font-bold leading-none text-white">
                        {stats?.hired ?? 0}
                      </p>
                      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-white/60">
                        workers hired
                      </p>
                    </div>
                    <div className="absolute bottom-7 right-6 flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 shadow-card backdrop-blur-md">
                      <Star size={13} className="fill-marigold-400 text-marigold-400" aria-hidden="true" />
                      <span className="text-xs font-bold text-white">
                        {stats?.perfAvg != null ? `${Number(stats.perfAvg).toFixed(1)} ★` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick metrics — compact glass strip */}
                <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <HeroMetric
                    icon={Rocket}
                    label="Open jobs"
                    value={stats?.open ?? 0}
                    sub="awaiting applications"
                  />
                  <HeroMetric
                    icon={Users}
                    label="Workers hired"
                    value={stats?.hired ?? 0}
                    sub="assigned to your jobs"
                  />
                  <HeroMetric
                    icon={ClipboardList}
                    label="Pending apps"
                    value={stats?.pendingApplications ?? 0}
                    sub="awaiting your review"
                  />
                  <HeroMetric
                    icon={Star}
                    label="Team rating"
                    value={stats?.perfAvg != null ? Number(stats.perfAvg).toFixed(1) : '—'}
                    sub={stats?.perfWorkers ? `${stats.perfWorkers} rated worker${stats.perfWorkers === 1 ? '' : 's'}` : 'No ratings yet'}
                  />
                </div>
              </div>
            </section>
          )}

          {!employerId ? (
            <Card className="py-10 text-center">
              <p className="mb-1 text-3xl" aria-hidden="true">
                🏢
              </p>
              <h2 className="font-display text-lg font-semibold text-ink">
                Account not recognised
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                We couldn&apos;t identify your account. Please sign in again.
              </p>
            </Card>
          ) : loading ? (
            <div data-testid="employer-dashboard-loading" className="space-y-6" aria-busy="true">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Card key={i} className="space-y-3">
                    <Skeleton className="h-11 w-11 rounded-xl" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-28" />
                  </Card>
                ))}
              </div>
              <Card>
                <Skeleton className="mb-4 h-5 w-48" />
                <div className="space-y-3">
                  {Array.from({ length: 2 }, (_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              </Card>
            </div>
          ) : error ? (
            <Card className="border-danger/30 bg-danger-soft/40">
              <h2 className="font-display text-lg font-semibold text-ink">
                Couldn&apos;t load your dashboard
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{error}</p>
              <button
                type="button"
                onClick={() => fetchStats()}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700 active:bg-teal-100/50"
              >
                Try again
              </button>
            </Card>
          ) : (
            <>
              {/* ---------------------------------------- Stat cards ---- */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <PremiumStat
                  icon={Rocket}
                  label="Active job posts"
                  value={stats?.open ?? 0}
                  note="Currently open for applications"
                  trend={postsTrend}
                  accent="success"
                />
                <PremiumStat
                  icon={ClipboardList}
                  label="Total job posts"
                  value={stats?.total ?? 0}
                  note="Posted so far, across all statuses"
                  trend={
                    (stats?.total ?? 0) > 0
                      ? { trend: 'flat', label: 'All time' }
                      : { trend: 'neutral', label: 'Post your first' }
                  }
                  accent="primary"
                />
                <PremiumStat
                  icon={Handshake}
                  label="Workers hired"
                  value={stats?.hired ?? 0}
                  note="Assigned to your job postings"
                  trend={hiredTrend}
                  accent="warning"
                />
                <PremiumStat
                  icon={Star}
                  label="Avg. worker rating"
                  value={
                    stats?.perfAvg == null
                      ? '—'
                      : `${Number(stats.perfAvg).toFixed(2)} / 5`
                  }
                  note={
                    stats?.perfReviews == null || stats.perfReviews === 0
                      ? 'No reviews yet'
                      : `${stats.perfReviews} review${stats.perfReviews === 1 ? '' : 's'} across ${stats.perfWorkers ?? 0} worker${stats.perfWorkers === 1 ? '' : 's'}`
                  }
                  trend={ratingTrend}
                  accent="warning"
                />
                <PremiumStat
                  icon={Banknote}
                  label="Avg. wage / day"
                  value={stats?.avgWage == null ? '—' : formatWage(stats.avgWage)}
                  note={
                    stats?.avgWage == null ? 'No open postings yet' : 'Across open jobs'
                  }
                  trend={
                    stats?.avgWage != null
                      ? { trend: 'flat', label: 'Per day' }
                      : { trend: 'neutral', label: 'Post a job' }
                  }
                  accent="info"
                />
              </div>

              {/* --------------------------- Quick actions + recent ---- */}
              <div className="grid gap-6 lg:grid-cols-12">
                <Card className="lg:col-span-5">
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <Sparkles size={16} className="text-teal-700" aria-hidden="true" />
                        Quick actions
                      </span>
                    }
                    subtitle="Everything you need, one tap away"
                  />
                  <div className="space-y-2.5">
                    {actions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Link
                          key={action.to}
                          to={action.to}
                          className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-teal-500/40 hover:shadow-card-hover"
                        >
                          <span
                            className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${action.tint}`}
                            aria-hidden="true"
                          >
                            <Icon size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink">
                              {action.title}
                            </span>
                            <span className="block truncate text-xs text-ink-soft">
                              {action.description}
                            </span>
                          </span>
                          <ArrowRight
                            size={15}
                            className="text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700"
                            aria-hidden="true"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </Card>

                {/* Recent postings */}
                <Card className="lg:col-span-7">
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <Briefcase size={16} className="text-teal-700" aria-hidden="true" />
                        Recent postings
                      </span>
                    }
                    subtitle={
                      (stats?.recentJobs ?? []).length > 0
                        ? 'Your latest job posts'
                        : 'Post your first job to see it here'
                    }
                    action={
                      <Link
                        to="/employer/jobs"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-500"
                      >
                        View all
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    }
                  />
                  {(stats?.recentJobs ?? []).length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center">
                      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700" aria-hidden="true">
                        <Briefcase size={20} />
                      </span>
                      <p className="text-sm text-ink-soft">
                        No job posts yet — create your first opening to start
                        matching with workers.
                      </p>
                      <Link
                        to="/employer/jobs/new"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
                      >
                        <Plus size={15} aria-hidden="true" />
                        Post a job
                      </Link>
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {stats?.recentJobs.map((job) => (
                        <li
                          key={job.id}
                          className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                              <JobStatusBadge status={job.status} />
                            </div>
                            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} aria-hidden="true" />
                                {job.location || '—'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Banknote size={11} aria-hidden="true" />
                                <span className="font-semibold text-teal-700">
                                  {formatWage(job.wagePerDay)}
                                  <span className="text-ink-soft">/day</span>
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Building2 size={11} aria-hidden="true" />
                                Posted {formatDate(job.createdAt)}
                              </span>
                            </p>
                          </div>
                          <Link
                            to={
                              job.status === 'OPEN'
                                ? `/employer/jobs/edit/${job.id}`
                                : '/employer/jobs'
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700"
                          >
                            {job.status === 'OPEN' ? 'Manage' : 'View'}
                            <ArrowRight size={13} aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {/* --------------------------- Worker breakdown ---- */}
              <Card>
                <CardHeader
                  title="Worker rating breakdown"
                  subtitle={
                    (stats?.breakdown ?? []).length === 0
                      ? 'Assign a worker to a job to see their ratings here.'
                      : undefined
                  }
                />
                {(stats?.breakdown ?? []).length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700" aria-hidden="true">
                      <Users size={20} />
                    </span>
                    <p className="text-sm text-ink-soft">
                      No hired workers yet — assign a worker to a job to see
                      their ratings here.
                    </p>
                    <Link
                      to="/employer/jobs"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700"
                    >
                      Go to my job posts
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {stats?.breakdown.map((entry) => (
                      <li
                        key={entry.workerId}
                        className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <WorkerAvatar name={entry.name} id={entry.workerId} />
                        <span className="min-w-0 flex-1 font-semibold text-ink">
                          {entry.name}
                        </span>
                        {entry.unavailable ? (
                          <span className="text-sm text-ink-soft">
                            Ratings unavailable
                          </span>
                        ) : entry.averageRating == null ? (
                          <span className="text-sm text-ink-soft">No reviews yet</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Stars rating={entry.averageRating} />
                            <span className="text-sm text-ink-soft">
                              {entry.averageRating}/5
                            </span>
                          </span>
                        )}
                        <span className="rounded-full border border-line bg-line/50 px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                          {entry.reviewCount} review{entry.reviewCount === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
