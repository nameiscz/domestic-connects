import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { formatWage } from '../utils/jobFormat';
import { useToasts } from '../hooks/useToasts';
import ToastStack from '../components/ToastStack';
import StarRating from '../components/StarRating';

const REMARKS_MAX = 1000;

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

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
  const { toasts, pushToast, dismissToast } = useToasts();

  const role = currentUser?.role;
  const isEmployer = role === 'EMPLOYER';

  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState('');

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');

  const [workerId, setWorkerId] = useState('');
  const [jobId, setJobId] = useState('');
  const [rating, setRating] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const selectedWorker =
    workers.find((w) => String(w.id) === String(workerId)) || null;

  // ------------------------------------------------------------------
  // Worker pool (employer/admin-accessible GET /api/auth/workers)
  // ------------------------------------------------------------------
  const loadWorkers = useCallback(async (signal) => {
    setWorkersLoading(true);
    setWorkersError('');
    try {
      const { data } = await axiosInstance.get('/api/auth/workers', { signal });
      setWorkers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') {
        setWorkersError(
          err.response?.data?.message || 'Unable to load workers. Please try again.'
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
  const loadJobs = useCallback(async (signal) => {
    setJobsLoading(true);
    setJobsError('');
    try {
      const { data } = await axiosInstance.get('/api/jobs', { signal });
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') {
        setJobsError(
          err.response?.data?.message || 'Unable to load jobs. Please try again.'
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
    const assigned = new Set();
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

  const clearError = (field) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!workerId) next.workerId = 'Select a worker.';
    if (!jobId) next.jobId = 'Select a job.';
    if (!rating) next.rating = 'Choose a rating from 1 to 5.';
    if (remarks.trim().length > REMARKS_MAX) {
      next.remarks = `Remarks must be ${REMARKS_MAX} characters or fewer.`;
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!currentUser?.name) {
      pushToast('Unable to identify your account. Please sign in again.', 'danger');
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
      await axiosInstance.post('/api/performance/review', payload);
      pushToast(`Review submitted for ${selectedWorker?.name ?? 'the worker'}.`);
      // Reset the form so another review can be submitted in the same session.
      setWorkerId('');
      setJobId('');
      setRating(0);
      setRemarks('');
      setErrors({});
    } catch (err) {
      pushToast(
        err.response?.data?.message || 'Unable to submit the review. Please try again.',
        'danger'
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
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">👷</p>
            <h5 className="card-title">Account not recognised</h5>
            <p className="card-text text-muted mb-0">
              We couldn&apos;t identify your account. Please sign in again.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-busy={submitting}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="row justify-content-center">
        <div className="col-lg-8 col-xl-7">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <h3 className="h5 mb-0">Submit performance review</h3>
            <Link to={ROLE_HOME[role] || '/'} className="btn btn-outline-secondary btn-sm">
              ← Back to dashboard
            </Link>
          </div>

          <div className="card shadow-sm">
            <div className="card-body p-4">
              <p className="text-muted small mb-4">
                Rate the worker&apos;s performance on a job you&apos;ve assigned.
                The review is recorded under{' '}
                <strong>{currentUser.name}</strong>.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label htmlFor="review-worker" className="form-label">
                    Worker
                  </label>
                  {workersLoading || (isEmployer && jobsLoading) ? (
                    <div className="text-muted small py-2">Loading workers…</div>
                  ) : workersError || (isEmployer && jobsError) ? (
                    <div className="alert alert-danger py-2 mb-0" role="alert">
                      <p className="mb-2">{workersError || jobsError}</p>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => {
                          loadWorkers();
                          loadJobs();
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  ) : visibleWorkers.length === 0 ? (
                    isEmployer ? (
                      <div className="text-muted small py-2">
                        No assigned workers yet — assign a worker to one of
                        your job posts to start reviewing them.
                      </div>
                    ) : (
                      <p className="text-muted small mb-0">No workers found.</p>
                    )
                  ) : (
                    <select
                      id="review-worker"
                      className={`form-select ${errors.workerId ? 'is-invalid' : ''}`}
                      value={workerId}
                      onChange={(e) => {
                        setWorkerId(e.target.value);
                        // Job options depend on the worker — drop any stale
                        // job picked for the previous worker.
                        setJobId('');
                        clearError('workerId');
                        clearError('jobId');
                      }}
                      aria-invalid={Boolean(errors.workerId)}
                    >
                      <option value="">Select a worker…</option>
                      {visibleWorkers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.name} ({worker.email})
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.workerId && (
                    <div className="invalid-feedback">{errors.workerId}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="review-job" className="form-label">
                    Job
                  </label>
                  {jobsLoading ? (
                    <div className="text-muted small py-2">Loading jobs…</div>
                  ) : jobsError ? (
                    <div className="alert alert-danger py-2 mb-0" role="alert">
                      <p className="mb-2">{jobsError}</p>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => loadJobs()}
                      >
                        Try again
                      </button>
                    </div>
                  ) : !workerId ? (
                    <p className="text-muted small mb-0">
                      Choose a worker first to see their assigned jobs.
                    </p>
                  ) : jobsForSelectedWorker.length === 0 ? (
                    <p className="text-muted small mb-0">
                      No assigned jobs for {selectedWorker?.name ?? 'this worker'}{' '}
                      yet. Assign the worker to a job first.
                    </p>
                  ) : (
                    <select
                      id="review-job"
                      className={`form-select ${errors.jobId ? 'is-invalid' : ''}`}
                      value={jobId}
                      onChange={(e) => {
                        setJobId(e.target.value);
                        clearError('jobId');
                      }}
                      aria-invalid={Boolean(errors.jobId)}
                    >
                      <option value="">Select a job…</option>
                      {jobsForSelectedWorker.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title} · {formatWage(job.wagePerDay)}/day
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.jobId && (
                    <div className="invalid-feedback">{errors.jobId}</div>
                  )}
                </div>

                <div className="mb-3">
                  <span className="form-label d-block">Rating</span>
                  <StarRating value={rating} onChange={setRating} />
                  <div className="form-text">
                    {rating
                      ? `${rating}/5 — ${RATING_LABELS[rating]}`
                      : 'Tap a star to rate 1–5.'}
                  </div>
                  {errors.rating && (
                    <div className="invalid-feedback d-block">{errors.rating}</div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-baseline">
                    <label htmlFor="review-remarks" className="form-label">
                      Remarks
                    </label>
                    <span className="text-muted small">
                      {remarks.length}/{REMARKS_MAX}
                    </span>
                  </div>
                  <textarea
                    id="review-remarks"
                    rows={4}
                    maxLength={REMARKS_MAX}
                    className={`form-control ${errors.remarks ? 'is-invalid' : ''}`}
                    placeholder="Optional notes on the worker's performance…"
                    value={remarks}
                    onChange={(e) => {
                      setRemarks(e.target.value);
                      clearError('remarks');
                    }}
                    aria-invalid={Boolean(errors.remarks)}
                  />
                  {errors.remarks && (
                    <div className="invalid-feedback">{errors.remarks}</div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        aria-hidden="true"
                      />
                      Submitting…
                    </>
                  ) : (
                    'Submit review'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
