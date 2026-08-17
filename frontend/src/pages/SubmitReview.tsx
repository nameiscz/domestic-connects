import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, jobApi, performanceApi } from '../api';
import { ROLE_HOME } from '../constants/roles';
import { formatWage } from '../utils/jobFormat';
import { Button, Card, Select, Textarea, ToastStack, useToast } from '../components/ui';
import StarRating from '../components/StarRating';
import type { JobPost, Role, User } from '../types';

const REMARKS_MAX = 1000;

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

interface ReviewErrors {
  workerId?: string;
  jobId?: string;
  rating?: string;
  remarks?: string;
}

/**
 * SubmitReview — a performance review form for EMPLOYER and ADMIN roles
 * (POST /api/performance/review via the API gateway).
 *
 * - Worker picker  → GET /api/auth/workers (allowed for employers/admins)
 * - Job picker     → GET /api/jobs, narrowed to ASSIGNED postings whose
 *                    persisted workerId matches the selected worker (the
 *                    job-service stores the assignee since the worker-filter
 *                    feature), plus the reviewer's own postings for
 *                    employers — so a review always targets work the worker
 *                    was actually assigned to
 * - Rating 1–5 (required) and remarks (optional, ≤ 1000 chars)
 * - reviewedBy is required by the backend and is taken from the signed-in
 *   account's name.
 */
export default function SubmitReview() {
  const { currentUser } = useAuth();
  const { toasts, pushToast, dismissToast } = useToast();

  const role = currentUser?.role;
  const isEmployer = role === 'EMPLOYER';

  const [workers, setWorkers] = useState<User[]>([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState('');

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');

  const [workerId, setWorkerId] = useState('');
  const [jobId, setJobId] = useState('');
  const [rating, setRating] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const selectedWorker =
    workers.find((w) => String(w.id) === String(workerId)) || null;

  // ------------------------------------------------------------------
  // Worker pool (employer/admin-accessible GET /api/auth/workers)
  // ------------------------------------------------------------------
  const loadWorkers = useCallback(async (signal?: AbortSignal) => {
    setWorkersLoading(true);
    setWorkersError('');
    try {
      const list = await authApi.getWorkers({ signal });
      setWorkers(Array.isArray(list) ? list : []);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setWorkersError(
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Unable to load workers. Please try again.'
        );
      }
    } finally {
      setWorkersLoading(false);
    }
  }, []);

  // ------------------------------------------------------------------
  // Job pool (GET /api/jobs — all active postings; the worker/employer
  // narrowing happens when rendering so the picker follows the selected
  // worker without refetching)
  // ------------------------------------------------------------------
  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    setJobsLoading(true);
    setJobsError('');
    try {
      const list = await jobApi.listJobs({ signal });
      setJobs(Array.isArray(list) ? list : []);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setJobsError(
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Unable to load jobs. Please try again.'
        );
      }
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Jobs offered for the selected worker: only ASSIGNED postings whose
  // persisted workerId matches, and (for employers) the reviewer's own posts.
  const jobsForSelectedWorker = jobs.filter(
    (job) =>
      job.status === 'ASSIGNED' &&
      String(job.workerId ?? '') === String(workerId) &&
      (!isEmployer || String(job.employerId) === String(currentUser?.id))
  );

  // Employers may only review workers they have actually hired — the picker
  // is narrowed to the assignees of the employer's ASSIGNED job posts.
  // Admins see the full worker directory.
  const visibleWorkers = useMemo(() => {
    if (!isEmployer) return workers;
    const assigned = new Set<string>();
    jobs.forEach((job) => {
      if (
        job.status === 'ASSIGNED' &&
        String(job.employerId) === String(currentUser?.id) &&
        job.workerId != null
      ) {
        assigned.add(String(job.workerId));
      }
    });
    return workers.filter((w) => assigned.has(String(w.id)));
  }, [isEmployer, currentUser?.id, jobs, workers]);

  useEffect(() => {
    if (!currentUser?.id) {
      setWorkersLoading(false);
      setJobsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    loadWorkers(controller.signal);
    loadJobs(controller.signal);
    return () => controller.abort();
  }, [currentUser?.id, loadWorkers, loadJobs]);

  const clearError = (field: keyof ReviewErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): ReviewErrors => {
    const next: ReviewErrors = {};
    if (!workerId) next.workerId = 'Select a worker.';
    if (!jobId) next.jobId = 'Select a job.';
    if (!rating) next.rating = 'Choose a rating from 1 to 5.';
    if (remarks.trim().length > REMARKS_MAX) {
      next.remarks = `Remarks must be ${REMARKS_MAX} characters or fewer.`;
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!currentUser?.name) {
      pushToast('Unable to identify your account. Please sign in again.', 'error');
      return;
    }

    const payload = {
      workerId: Number(workerId),
      jobId: Number(jobId),
      rating,
      remarks: remarks.trim(),
      reviewedBy: currentUser.name,
    };

    setSubmitting(true);
    try {
      await performanceApi.submitReview(payload);
      pushToast(`Review submitted for ${selectedWorker?.name ?? 'the worker'}.`);
      // Reset the form so another review can be submitted in the same session.
      setWorkerId('');
      setJobId('');
      setRating(0);
      setRemarks('');
      setErrors({});
    } catch (err) {
      pushToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to submit the review. Please try again.',
        'error'
      );
      // Keep the form filled so the reviewer can adjust and retry.
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (!currentUser?.id) {
    return (
      <section>
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
      </section>
    );
  }

  return (
    <section aria-busy={submitting}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-xl font-semibold text-ink">
            Submit performance review
          </h3>
          <Link
            to={ROLE_HOME[role as Role] || '/'}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700"
          >
            ← Back to dashboard
          </Link>
        </div>

        <Card>
          <p className="mb-5 text-sm text-ink-soft">
            Rate the worker&apos;s performance on a job you&apos;ve assigned.
            The review is recorded under <strong className="text-ink">{currentUser.name}</strong>.
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              {workersLoading || (isEmployer && jobsLoading) ? (
                <p className="py-2 text-sm text-ink-soft">Loading workers…</p>
              ) : workersError || (isEmployer && jobsError) ? (
                <div className="rounded-xl border border-danger/30 bg-danger-soft/40 px-3 py-2 text-sm" role="alert">
                  <p className="mb-2 text-danger-text">{workersError || jobsError}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      loadWorkers();
                      loadJobs();
                    }}
                  >
                    Try again
                  </Button>
                </div>
              ) : visibleWorkers.length === 0 ? (
                isEmployer ? (
                  <p className="py-2 text-sm text-ink-soft">
                    No assigned workers yet — assign a worker to one of
                    your job posts to start reviewing them.
                  </p>
                ) : (
                  <p className="mb-0 text-sm text-ink-soft">No workers found.</p>
                )
              ) : (
                <Select
                  id="review-worker"
                  label="Worker"
                  value={workerId}
                  error={errors.workerId}
                  onChange={(e) => {
                    setWorkerId(e.target.value);
                    // Job options depend on the worker — drop any stale
                    // job picked for the previous worker.
                    setJobId('');
                    clearError('workerId');
                    clearError('jobId');
                  }}
                >
                  <option value="">Select a worker…</option>
                  {visibleWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name} ({worker.email})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div>
              {jobsLoading ? (
                <p className="py-2 text-sm text-ink-soft">Loading jobs…</p>
              ) : jobsError ? (
                <div className="rounded-xl border border-danger/30 bg-danger-soft/40 px-3 py-2 text-sm" role="alert">
                  <p className="mb-2 text-danger-text">{jobsError}</p>
                  <Button type="button" variant="secondary" size="sm" onClick={() => loadJobs()}>
                    Try again
                  </Button>
                </div>
              ) : !workerId ? (
                <p className="py-2 text-sm text-ink-soft">
                  Choose a worker first to see their assigned jobs.
                </p>
              ) : jobsForSelectedWorker.length === 0 ? (
                <p className="py-2 text-sm text-ink-soft">
                  No assigned jobs for {selectedWorker?.name ?? 'this worker'} yet.
                  Assign the worker to a job first.
                </p>
              ) : (
                <Select
                  id="review-job"
                  label="Job"
                  value={jobId}
                  onChange={(e) => {
                    setJobId(e.target.value);
                    clearError('jobId');
                  }}
                >
                  <option value="">Select a job…</option>
                  {jobsForSelectedWorker.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} · {formatWage(job.wagePerDay)}/day
                    </option>
                  ))}
                </Select>
              )}
              {/* Validation error renders even while the picker is hidden
                  (e.g. no worker selected yet). */}
              {errors.jobId && (
                <p className="mt-1 text-xs font-medium text-danger-text" role="alert">
                  {errors.jobId}
                </p>
              )}
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-ink">Rating</span>
              <StarRating value={rating} onChange={setRating} />
              <p className="mt-1.5 text-sm text-ink-soft">
                {rating
                  ? `${rating}/5 — ${RATING_LABELS[rating]}`
                  : 'Tap a star to rate 1–5.'}
              </p>
              {errors.rating && (
                <p className="mt-1 text-xs font-medium text-danger-text" role="alert">
                  {errors.rating}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <Textarea
                  id="review-remarks"
                  label="Remarks"
                  rows={4}
                  maxLength={REMARKS_MAX}
                  placeholder="Optional notes on the worker's performance…"
                  value={remarks}
                  error={errors.remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    clearError('remarks');
                  }}
                />
                <span className="ml-2 text-xs text-ink-soft">
                  {remarks.length}/{REMARKS_MAX}
                </span>
              </div>
            </div>

            <Button type="submit" disabled={submitting} isLoading={submitting}>
              {submitting ? 'Submitting…' : 'Submit review'}
            </Button>
          </form>
        </Card>
      </div>
    </section>
  );
}
