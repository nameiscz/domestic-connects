import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  IndianRupee,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { jobApi } from '../../api';
import { formatWageNumber } from '../../utils/jobFormat';
import { Badge, Button, Card, EmptyState, Select, Skeleton, ToastStack, useToast } from '../../components/ui';
import JobStatusBadge from '../../components/JobStatusBadge';
import Modal from '../../components/Modal';
import type { JobPost } from '../../types';

type SortMode = 'newest' | 'wage';

const PAGE_SIZE = 6;

/** Salary buckets shown in the filter — a `null` bound means "no limit". */
const SALARY_BUCKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any salary', min: null, max: null },
  { label: 'Under ₹400/day', min: null, max: 400 },
  { label: '₹400 – ₹700/day', min: 400, max: 700 },
  { label: '₹700 – ₹1,000/day', min: 700, max: 1000 },
  { label: 'Above ₹1,000/day', min: 1000, max: null },
];

/** Coarse job-type buckets inferred from the title (no type field on the API). */
const JOB_TYPES: { label: string; match: RegExp }[] = [
  { label: 'Household help', match: /house|clean|maid|cook|cooking|helper/i },
  { label: 'Care', match: /care|elderly|baby|nanny|nurse/i },
  { label: 'Driver', match: /driver|driving/i },
  { label: 'Gardening', match: /garden|lawn|plant/i },
  { label: 'Other', match: /.*/ },
];

function inferJobType(title: string): string {
  return JOB_TYPES.find((t) => t.match.test(title))?.label ?? 'Other';
}

/** Deterministic avatar for an employer — initials on a teal gradient. */
function EmployerAvatar({ jobId, name }: { jobId: number; name: string }) {
  const initials = (name || `E${jobId}`)
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hue = 160 + ((jobId * 47) % 60); // teal→emerald family
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 42% 34%), hsl(${hue + 24} 45% 24%))` }}
    >
      {initials || 'E'}
    </span>
  );
}

/** Fetch-error banner with a retry action. */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-danger/30 bg-danger-soft/40">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-display text-base font-semibold text-ink">Couldn&apos;t load jobs</h4>
          <p className="mt-0.5 text-sm text-ink-soft">{message}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}

export default function JobBrowse() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<number[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<number[]>([]);
  const [detailsJob, setDetailsJob] = useState<JobPost | null>(null);

  // Client-side filtering/sorting/pagination.
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('all');
  const [salaryBucket, setSalaryBucket] = useState(0);
  const [jobType, setJobType] = useState('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [page, setPage] = useState(1);
  const { toasts, pushToast, dismissToast } = useToast();

  // Persisted "saved jobs" bookmarks (localStorage — no backend endpoint).
  useEffect(() => {
    if (!workerId) return;
    try {
      const raw = localStorage.getItem(`dc_saved_jobs_${workerId}`);
      const parsed = raw ? (JSON.parse(raw) as number[]) : [];
      setSavedJobIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSavedJobIds([]);
    }
  }, [workerId]);

  const fetchJobs = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await jobApi.listJobs({ signal });
        setJobs(Array.isArray(data) ? data : []);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load jobs. Please try again.';
          setLoadError(message);
          pushToast(message, 'error');
        }
      } finally {
        setLoading(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchJobs(controller.signal);
    return () => controller.abort();
  }, [fetchJobs]);

  const toggleSaved = (job: JobPost) => {
    if (!workerId) return;
    setSavedJobIds((prev) => {
      const isSaved = prev.includes(job.id);
      const next = isSaved ? prev.filter((id) => id !== job.id) : [...prev, job.id];
      try {
        localStorage.setItem(`dc_saved_jobs_${workerId}`, JSON.stringify(next));
      } catch {
        // Private mode etc. — the in-memory state still works for the session.
      }
      pushToast(isSaved ? `Removed "${job.title}" from saved jobs.` : `Saved "${job.title}" for later.`);
      return next;
    });
  };

  const handleApply = async (job: JobPost) => {
    if (!workerId || applyingId) return;

    setApplyingId(job.id);
    try {
      // Applying records a PENDING application — it does not assign. The
      // employer reviews the worker's profile and accepts or declines.
      await jobApi.applyToJob(job.id);
      setAppliedJobIds((prev) => (prev.includes(job.id) ? prev : [...prev, job.id]));
      pushToast(`Application sent for "${job.title}" — the employer will review it.`);
      if (detailsJob?.id === job.id) setDetailsJob(null);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to apply. Please try again.';
      pushToast(message, 'error');
    } finally {
      setApplyingId(null);
    }
  };

  const locations = useMemo(
    () => [...new Set(jobs.map((j) => j.location).filter(Boolean))].sort(),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bucket = SALARY_BUCKETS[salaryBucket];
    return jobs.filter((job) => {
      if (q && !(job.title.toLowerCase().includes(q) || job.location.toLowerCase().includes(q))) {
        return false;
      }
      if (location !== 'all' && job.location !== location) return false;
      if (bucket && bucket.min != null && job.wagePerDay < bucket.min) return false;
      if (bucket && bucket.max != null && job.wagePerDay >= bucket.max) return false;
      if (jobType !== 'all' && inferJobType(job.title) !== jobType) return false;
      return true;
    });
  }, [jobs, query, location, salaryBucket, jobType]);

  const visibleJobs = useMemo(
    () =>
      [...filteredJobs].sort((a, b) => {
        if (sort === 'wage') return b.wagePerDay - a.wagePerDay;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      }),
    [filteredJobs, sort]
  );

  // "Recommended for you" — OPEN jobs ranked by proximity to the worker's
  // service area, then by recency. Honest signal: when the worker has no
  // service area set, recommendations fall back to the newest openings.
  const recommendedJobs = useMemo(() => {
    const area =
      currentUser && 'serviceArea' in currentUser
        ? String(currentUser.serviceArea ?? '').trim().toLowerCase()
        : '';
    const candidates = visibleJobs.filter((j) => j.status === 'OPEN');
    const scored = candidates
      .map((job) => {
        let score = 0;
        if (area) {
          const loc = job.location.toLowerCase();
          if (loc === area) score += 3;
          else if (loc.includes(area) || area.includes(loc)) score += 1;
        }
        const ageDays = Math.max(
          0,
          (Date.now() - new Date(job.createdAt).getTime()) / 86_400_000
        );
        score += Math.max(0, 1 - ageDays / 14); // newer posts score higher
        return { job, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ job }) => job);
    return scored.slice(0, 3);
  }, [visibleJobs, currentUser]);

  const openCount = filteredJobs.filter((job) => job.status === 'OPEN').length;

  // Recommended jobs are shown in their own section and excluded from the
  // "All jobs" grid so nothing renders twice.
  const recommendedIds = new Set(recommendedJobs.map((j) => j.id));
  const browseJobs = visibleJobs.filter((j) => !recommendedIds.has(j.id));
  const pageCount = Math.max(1, Math.ceil(browseJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageJobs = browseJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filterActive =
    query.trim() !== '' || location !== 'all' || salaryBucket !== 0 || jobType !== 'all';

  const clearFilters = () => {
    setQuery('');
    setLocation('all');
    setSalaryBucket(0);
    setJobType('all');
    setPage(1);
  };

  return (
    <section aria-busy={loading}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold text-ink">Job marketplace</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {!loading && !loadError
              ? `${openCount} open of ${filteredJobs.length} — updated just now`
              : 'Find your next opportunity'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => fetchJobs()} isLoading={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Search + filter toolbar */}
      <Card className="mb-6 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search jobs, e.g. “cook in Bengaluru”"
              aria-label="Search jobs"
              className="w-full rounded-xl border border-line bg-canvas py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:items-center">
            <Select
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by location"
              className="lg:w-40"
            >
              <option value="all">All locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>

            <Select
              value={salaryBucket}
              onChange={(e) => {
                setSalaryBucket(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Filter by salary"
              className="lg:w-44"
            >
              {SALARY_BUCKETS.map((b, i) => (
                <option key={b.label} value={i}>
                  {b.label}
                </option>
              ))}
            </Select>

            <Select
              value={jobType}
              onChange={(e) => {
                setJobType(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by job type"
              className="lg:w-44"
            >
              <option value="all">All job types</option>
              {JOB_TYPES.filter((t) => t.label !== 'Other').map((t) => (
                <option key={t.label} value={t.label}>
                  {t.label}
                </option>
              ))}
            </Select>

            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              aria-label="Sort jobs"
              className="lg:w-40"
            >
              <option value="newest">Newest first</option>
              <option value="wage">Wage (high → low)</option>
            </Select>
          </div>
        </div>

        {filterActive && (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-soft">
            <SlidersHorizontal size={13} aria-hidden="true" />
            <span>
              {visibleJobs.length} result{visibleJobs.length === 1 ? '' : 's'} with active filters
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-teal-700 transition-colors hover:bg-teal-100/60"
            >
              <X size={12} aria-hidden="true" /> Clear all
            </button>
          </div>
        )}
      </Card>

      {/* Recommended for you */}
      {!loading && !loadError && recommendedJobs.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-marigold-100 text-marigold-600">
              <Sparkles size={16} aria-hidden="true" />
            </span>
            <div>
              <h4 className="font-display text-lg font-semibold leading-tight text-ink">
                Recommended for you
              </h4>
              <p className="text-xs text-ink-soft">
                {currentUser && 'serviceArea' in currentUser && currentUser.serviceArea
                  ? `Matched near ${currentUser.serviceArea}`
                  : 'Fresh openings we think you’ll like'}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recommendedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                applyingId={applyingId}
                appliedJobIds={appliedJobIds}
                savedJobIds={savedJobIds}
                onApply={handleApply}
                onToggleSave={toggleSaved}
                onViewDetails={setDetailsJob}
              />
            ))}
          </div>
        </div>
      )}

      {/* All jobs */}
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display text-lg font-semibold text-ink">All jobs</h4>
        {!loading && !loadError && visibleJobs.length > PAGE_SIZE && (
          <span className="text-xs text-ink-soft">
            Page {safePage} of {pageCount}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div data-testid="jobs-loading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-9 w-24" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Fetch error state */}
      {!loading && loadError && <LoadError message={loadError} onRetry={() => fetchJobs()} />}

      {/* Empty state */}
      {!loading && !loadError && visibleJobs.length === 0 && (
        <EmptyState
          icon={<Briefcase size={26} />}
          title={filterActive ? 'No matching jobs' : 'No jobs posted yet'}
          message={
            filterActive
              ? 'Try a different search term or clear the filters.'
              : 'Check back soon — new opportunities are added regularly.'
          }
          action={
            filterActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Job card grid */}
      {!loading && !loadError && pageJobs.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                applyingId={applyingId}
                appliedJobIds={appliedJobIds}
                savedJobIds={savedJobIds}
                onApply={handleApply}
                onToggleSave={toggleSaved}
                onViewDetails={setDetailsJob}
              />
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <nav
              aria-label="Job pages"
              className="mt-6 flex items-center justify-center gap-2"
            >
              <Button
                variant="secondary"
                size="sm"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={15} aria-hidden="true" />
                Prev
              </Button>
              <span className="px-2 text-sm text-ink-soft" aria-live="polite">
                {safePage} / {pageCount}
              </span>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
                <ChevronRight size={15} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}

      {/* Details modal */}
      {detailsJob && (
        <Modal onClose={() => setDetailsJob(null)} labelledBy="job-details-title">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="job-details-title">
                {detailsJob.title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setDetailsJob(null)}
              />
            </div>
            <div className="modal-body">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <JobStatusBadge status={detailsJob.status} />
                <Badge variant="neutral">
                  <MapPin size={12} aria-hidden="true" /> {detailsJob.location}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-ink-soft">{detailsJob.description}</p>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
                <span className="text-sm text-ink-soft">Pay</span>
                <span className="font-display text-xl font-bold text-teal-700">
                  <IndianRupee
                    size={16}
                    strokeWidth={2.25}
                    className="mr-1 inline-block -translate-y-px text-teal-700"
                    aria-hidden="true"
                  />
                  {formatWageNumber(detailsJob.wagePerDay)}
                  <span className="ml-1 font-sans text-xs font-semibold text-ink-soft">/ day</span>
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" size="sm" onClick={() => setDetailsJob(null)}>
                Close
              </Button>
              {detailsJob.status === 'OPEN' &&
                (appliedJobIds.includes(detailsJob.id) ? (
                  <Button variant="secondary" size="sm" disabled>
                    Applied — awaiting review
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleApply(detailsJob)}
                    disabled={Boolean(applyingId) || !workerId}
                    isLoading={applyingId === detailsJob.id}
                  >
                    {applyingId === detailsJob.id ? 'Applying…' : 'Apply now'}
                  </Button>
                ))}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

interface JobCardProps {
  job: JobPost;
  applyingId: number | null;
  appliedJobIds: number[];
  savedJobIds: number[];
  onApply: (job: JobPost) => void;
  onToggleSave: (job: JobPost) => void;
  onViewDetails: (job: JobPost) => void;
}

function JobCard({
  job,
  applyingId,
  appliedJobIds,
  savedJobIds,
  onApply,
  onToggleSave,
  onViewDetails,
}: JobCardProps) {
  const isOpen = job.status === 'OPEN';
  const isApplying = applyingId === job.id;
  const applied = appliedJobIds.includes(job.id);
  const saved = savedJobIds.includes(job.id);
  const disabledNote =
    job.status === 'ASSIGNED'
      ? 'Already assigned'
      : job.status === 'CLOSED'
        ? 'Job closed'
        : '';

  return (
    <Card hover className="card group flex h-full flex-col">
      {/* Employer avatar + title + save */}
      <div className="mb-3 flex items-start gap-3">
        <EmployerAvatar jobId={job.id} name={`Employer ${job.employerId}`} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-base font-semibold leading-snug text-ink">
            {job.title}
          </h4>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
            <Building2 size={12} aria-hidden="true" />
            <span className="truncate">Posted by employer #{job.employerId}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(job)}
          aria-pressed={saved}
          aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`}
          title={saved ? 'Saved' : 'Save job'}
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg border transition-all duration-150 ${
            saved
              ? 'border-teal-500/40 bg-teal-100 text-teal-700'
              : 'border-line bg-white text-ink-soft hover:border-teal-500/40 hover:text-teal-700'
          }`}
        >
          <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>

      {/* Status + type badges */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <JobStatusBadge status={job.status} />
        <Badge variant="neutral">{inferJobType(job.title)}</Badge>
        {applied && isOpen && (
          <Badge variant="success">
            <Star size={11} aria-hidden="true" /> Application sent
          </Badge>
        )}
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-ink-soft">{job.description}</p>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} aria-hidden="true" /> {job.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} aria-hidden="true" /> Full-time
        </span>
        <span className="inline-flex items-center gap-1" title="Posted date">
          <Clock size={12} aria-hidden="true" />{' '}
          {new Date(job.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
          })}
        </span>
      </div>

      {/* Salary + actions */}
      <div className="mt-auto pt-4">
        <div className="mb-3 flex items-center justify-between border-t border-line pt-4">
          <span className="inline-flex items-baseline gap-1.5 rounded-full bg-teal-100 px-3 py-1 font-display text-lg font-bold text-teal-700">
            <IndianRupee size={15} strokeWidth={2.25} className="self-center text-teal-700" aria-hidden="true" />
            {formatWageNumber(job.wagePerDay)}
            <span className="font-sans text-xs font-semibold text-teal-700">/day</span>
          </span>
          {isOpen && (
            <button
              type="button"
              onClick={() => onViewDetails(job)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 transition-colors hover:text-teal-500"
            >
              View details <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>

        {isOpen ? (
          applied ? (
            <Button type="button" variant="secondary" className="w-full" disabled>
              Applied — awaiting review
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={() => onApply(job)}
              disabled={Boolean(applyingId)}
              isLoading={isApplying}
            >
              {isApplying ? 'Applying…' : 'Apply'}
            </Button>
          )
        ) : (
          <Button type="button" variant="secondary" className="w-full" disabled>
            {disabledNote}
          </Button>
        )}
      </div>
    </Card>
  );
}
