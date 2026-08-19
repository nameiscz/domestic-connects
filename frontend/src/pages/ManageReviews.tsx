import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquareText } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/jobFormat';
import { useToasts } from '../hooks/useToasts';
import ToastStack from '../components/ToastStack';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import StarRating from '../components/StarRating';
import type { JobPost, PerformanceReview, User, WorkerPerformanceReport } from '../types';

const REMARKS_MAX = 1000;

const STAR_COUNT = 5;

/** Renders a 1–5 star row (filled ★ for the rating, dim ☆ for the rest). */
function Stars({ rating }: { rating: number }) {
  const value = Number(rating) || 0;
  return (
    <span className="text-warning" role="img" aria-label={`${value} out of ${STAR_COUNT} stars`}>
      {'★'.repeat(Math.min(Math.max(value, 0), STAR_COUNT))}
      {'☆'.repeat(Math.max(STAR_COUNT - value, 0))}
    </span>
  );
}

/** Extracts the backend `message` from an unknown axios/network failure. */
function backendMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || fallback;
}

type EditErrors = Partial<Record<'rating' | 'remarks', string>>;

/**
 * ManageReviews — review the worker pool's performance reports and maintain
 * the individual reviews (EMPLOYER and ADMIN roles).
 *
 * - Pick a worker → GET /api/performance/worker/{workerId} (employers/admins
 *   may read any worker) → summary + review table.
 * - Edit  → PUT /api/performance/review/{id} ({ rating, remarks } only —
 *   workerId/jobId/reviewedBy are immutable on the backend).
 * - Delete → DELETE /api/performance/review/{id}. The backend restricts this
 *   to ADMINS, so the button is only rendered for the ADMIN role.
 */
export default function ManageReviews() {
  const { currentUser } = useAuth();
  const { toasts, pushToast, dismissToast } = useToasts();

  const role = currentUser?.role;
  const isAdmin = role === 'ADMIN';
  const isEmployer = role === 'EMPLOYER';
  const submitReviewPath = isAdmin ? '/admin/reviews/new' : '/employer/reviews/new';

  const [workers, setWorkers] = useState<User[]>([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState('');

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');

  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [report, setReport] = useState<WorkerPerformanceReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportRefresh, setReportRefresh] = useState(0);

  // Edit-review modal state
  const [editTarget, setEditTarget] = useState<PerformanceReview | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editRemarks, setEditRemarks] = useState('');
  const [editErrors, setEditErrors] = useState<EditErrors>({});
  const [saving, setSaving] = useState(false);

  // Delete-review modal state
  const [deleteTarget, setDeleteTarget] = useState<PerformanceReview | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedWorker =
    workers.find((w) => String(w.id) === String(selectedWorkerId)) || null;

  // ------------------------------------------------------------------
  // Worker pool (employer/admin-accessible GET /api/auth/workers)
  // ------------------------------------------------------------------
  const loadWorkers = useCallback(async (signal?: AbortSignal) => {
    setWorkersLoading(true);
    setWorkersError('');
    try {
      const { data } = await axiosInstance.get('/api/auth/workers', { signal });
      setWorkers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setWorkersError(backendMessage(err, 'Unable to load workers. Please try again.'));
      }
    } finally {
      setWorkersLoading(false);
    }
  }, []);

  // ------------------------------------------------------------------
  // Job pool (GET /api/jobs) — employers only, to determine which workers
  // they have hired. Admins manage the full worker directory instead.
  // ------------------------------------------------------------------
  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    setJobsLoading(true);
    setJobsError('');
    try {
      const { data } = await axiosInstance.get('/api/jobs', { signal });
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setJobsError(backendMessage(err, 'Unable to load jobs. Please try again.'));
      }
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      setWorkersLoading(false);
      setJobsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    loadWorkers(controller.signal);
    if (isEmployer) {
      loadJobs(controller.signal);
    } else {
      setJobsLoading(false);
    }
    return () => controller.abort();
  }, [currentUser?.id, isEmployer, loadWorkers, loadJobs]);

  // Employers may only manage reviews for workers they have actually hired —
  // the picker is narrowed to the assignees of the employer's ASSIGNED job
  // posts. Admins see the full worker directory.
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

  // ------------------------------------------------------------------
  // Performance report for the selected worker
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!selectedWorkerId) {
      setReport(null);
      setReportLoading(false);
      setReportError('');
      return undefined;
    }

    const controller = new AbortController();
    (async () => {
      setReportLoading(true);
      setReportError('');
      try {
        const { data } = await axiosInstance.get(
          `/api/performance/worker/${selectedWorkerId}`,
          { signal: controller.signal }
        );
        setReport(data);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setReportError(backendMessage(err, 'Unable to load the performance report.'));
        }
      } finally {
        setReportLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedWorkerId, reportRefresh]);

  // ------------------------------------------------------------------
  // Edit flow
  // ------------------------------------------------------------------
  const openEditModal = (review: PerformanceReview) => {
    if (saving || deleting) return;
    setDeleteTarget(null);
    setEditTarget(review);
    setEditRating(review.rating ?? 0);
    setEditRemarks(review.remarks ?? '');
    setEditErrors({});
  };

  const closeEditModal = useCallback(() => {
    if (!saving) setEditTarget(null);
  }, [saving]);

  const submitEdit = async () => {
    if (!editTarget || saving) return;

    const next: EditErrors = {};
    if (!editRating) next.rating = 'Choose a rating from 1 to 5.';
    if (editRemarks.trim().length > REMARKS_MAX) {
      next.remarks = `Remarks must be ${REMARKS_MAX} characters or fewer.`;
    }
    setEditErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await axiosInstance.put(`/api/performance/review/${editTarget.id}`, {
        rating: editRating,
        remarks: editRemarks.trim(),
      });
      pushToast('Review updated.');
      setEditTarget(null);
      setReportRefresh((r) => r + 1);
    } catch (err) {
      pushToast(backendMessage(err, 'Unable to update the review. Please try again.'), 'danger');
      // Keep the modal open so the reviewer can adjust and retry.
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Delete flow (ADMIN only — enforced by the backend)
  // ------------------------------------------------------------------
  const openDeleteModal = (review: PerformanceReview) => {
    if (saving || deleting) return;
    setEditTarget(null);
    setDeleteTarget(review);
  };

  const closeDeleteModal = useCallback(() => {
    if (!deleting) setDeleteTarget(null);
  }, [deleting]);

  const executeDelete = async () => {
    if (!deleteTarget || deleting) return;
    const review = deleteTarget;

    setDeleting(true);
    try {
      await axiosInstance.delete(`/api/performance/review/${review.id}`);
      pushToast('Review deleted.');
    } catch (err) {
      pushToast(
        backendMessage(err, 'Unable to delete the review. Please try again.'),
        'danger'
      );
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setReportRefresh((r) => r + 1);
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

  const reviews = report?.reviews ?? [];

  return (
    <section aria-busy={reportLoading}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header: submit action */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">Manage reviews</h3>
        <Link to={submitReviewPath} className="btn btn-primary btn-sm">
          + Submit review
        </Link>
      </div>

      {/* Worker picker */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="reviews-worker" className="mb-1.5 block text-sm font-semibold text-ink">
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
                      if (isEmployer) loadJobs();
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : visibleWorkers.length === 0 ? (
                isEmployer ? (
                  <div className="text-muted small py-2">
                    No assigned workers yet — assign a worker to one of your
                    job posts to start managing reviews.
                  </div>
                ) : (
                  <p className="text-muted small mb-0">No workers found.</p>
                )
              ) : (
                <select
                  id="reviews-worker"
                  className="w-full appearance-none rounded-[14px] border border-black/[0.08] bg-white px-4 py-3.5 text-[15px] text-ink transition-all duration-200 hover:border-black/[0.15] focus:border-teal-500 focus:outline-none focus:ring-[3px] focus:ring-teal-500/15 focus:shadow-[0_0_0_3px_rgba(21,94,99,0.1)]"
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                >
                  <option value="">Select a worker…</option>
                  {visibleWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name} ({worker.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report */}
      {!selectedWorkerId ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">👷</p>
            <h5 className="card-title">Select a worker</h5>
            <p className="card-text text-muted mb-0">
              Choose a worker above to view and manage their performance reviews.
            </p>
          </div>
        </div>
      ) : reportLoading ? (
        <div className="text-center py-5" data-testid="reviews-report-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading performance…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching the performance report…</p>
        </div>
      ) : reportError ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load the report</h4>
          <p className="mb-2">{reportError}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => setReportRefresh((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">🌟</p>
            <h5 className="card-title">No reviews yet</h5>
            <p className="card-text text-muted mb-3">
              {selectedWorker?.name ?? 'This worker'} has no reviews yet.
            </p>
            <Link to={submitReviewPath} className="btn btn-primary btn-sm">
              + Submit the first review
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="row g-3 mb-4">
            <StatCard
              icon={Star}
              label="Average rating"
              value={
                report?.averageRating == null ? (
                  '—'
                ) : (
                  <>
                    {report.averageRating}
                    <span className="text-muted fs-6"> / 5</span>
                  </>
                )
              }
              note={
                report?.averageRating == null
                  ? 'No ratings yet'
                  : `Across ${report.reviewCount} review${report.reviewCount === 1 ? '' : 's'}`
              }
              accent="warning"
            />
            <StatCard
              icon={MessageSquareText}
              label="Total reviews"
              value={report?.reviewCount ?? 0}
              note={`For ${selectedWorker?.name ?? 'this worker'}`}
              accent="primary"
            />
          </div>

          {/* Review history */}
          <div className="card shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Rating</th>
                    <th>Remarks</th>
                    <th>Reviewed by</th>
                    <th>Job</th>
                    <th>Date</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => {
                    const isDeleting = deleting && deleteTarget?.id === review.id;
                    return (
                      <tr key={review.id}>
                        <td>
                          <Stars rating={review.rating} />
                          <span className="text-muted small ms-1">
                            ({review.rating}/5)
                          </span>
                        </td>
                        <td className="text-muted">{review.remarks || '—'}</td>
                        <td>{review.reviewedBy || '—'}</td>
                        <td className="text-muted">#{review.jobId ?? '—'}</td>
                        <td className="text-muted">{formatDate(review.createdAt)}</td>
                        <td className="text-end">
                          <div className="d-inline-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => openEditModal(review)}
                              disabled={Boolean(saving) || Boolean(deleting)}
                            >
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => openDeleteModal(review)}
                                disabled={Boolean(saving) || Boolean(deleting)}
                              >
                                {isDeleting ? (
                                  <>
                                    <span
                                      className="spinner-border spinner-border-sm me-1"
                                      aria-hidden="true"
                                    />
                                    Deleting…
                                  </>
                                ) : (
                                  'Delete'
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Edit-review modal */}
      {editTarget && (
        <Modal onClose={closeEditModal} labelledBy="edit-review-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="edit-review-modal-title">
                Edit review
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeEditModal}
              />
            </div>
            <div className="modal-body">
              <p className="text-muted mb-3">
                Updating the review for <strong>{selectedWorker?.name}</strong>{' '}
                (submitted by {editTarget.reviewedBy || '—'}). Only the rating
                and remarks can be changed.
              </p>

              <div className="mb-3">
                <span className="mb-1.5 block text-sm font-semibold text-ink">Rating</span>
                <StarRating value={editRating} onChange={setEditRating} />
                {editErrors.rating && (
                  <div className="invalid-feedback d-block">{editErrors.rating}</div>
                )}
              </div>

              <div className="mb-2">
                <div className="d-flex justify-content-between align-items-baseline">
                  <label htmlFor="edit-review-remarks" className="mb-1.5 block text-sm font-semibold text-ink">
                    Remarks
                  </label>
                  <span className="text-muted small">
                    {editRemarks.length}/{REMARKS_MAX}
                  </span>
                </div>
                <textarea
                  id="edit-review-remarks"
                  rows={4}
                  maxLength={REMARKS_MAX}
                  className={`w-full rounded-[14px] border bg-white px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-soft/50 transition-all duration-200 focus:border-teal-500 focus:outline-none focus:ring-[3px] focus:ring-teal-500/15 focus:shadow-[0_0_0_3px_rgba(21,94,99,0.1)] ${editErrors.remarks ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-black/[0.08] hover:border-black/[0.15]'}`}
                  value={editRemarks}
                  onChange={(e) => {
                    setEditRemarks(e.target.value);
                    setEditErrors((prev) => ({ ...prev, remarks: undefined }));
                  }}
                />
                {editErrors.remarks && (
                  <div className="invalid-feedback">{editErrors.remarks}</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                data-autofocus
                className="btn btn-outline-secondary"
                onClick={closeEditModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitEdit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete-review confirmation modal */}
      {deleteTarget && (
        <Modal onClose={closeDeleteModal} labelledBy="delete-review-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="delete-review-modal-title">
                Delete review
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeDeleteModal}
              />
            </div>
            <div className="modal-body">
              <p className="mb-0">
                Are you sure you want to permanently delete the{' '}
                <strong>{deleteTarget.rating}/5</strong> review submitted by{' '}
                <strong>{deleteTarget.reviewedBy || '—'}</strong> for{' '}
                <strong>{selectedWorker?.name}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                data-autofocus
                className="btn btn-outline-secondary"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={executeDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      aria-hidden="true"
                    />
                    Deleting…
                  </>
                ) : (
                  'Delete review'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
