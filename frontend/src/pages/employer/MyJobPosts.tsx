import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, MapPin, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi, jobApi, performanceApi } from '../../api';
import { formatDate, formatWage } from '../../utils/jobFormat';
import { Button, Card, EmptyState, Select, Skeleton, ToastStack, useToast } from '../../components/ui';
import JobStatusBadge from '../../components/JobStatusBadge';
import WorkerProfileCard from '../../components/WorkerProfileCard';
import Modal from '../../components/Modal';
import type { JobApplication, JobPost, User, WorkerPerformanceReport } from '../../types';

/** Tailwind overrides that beat Bootstrap's modal classes (same specificity is
 *  won by cascade order — Bootstrap loads before index.css → Tailwind). */
const MODAL_CONTENT_CLASS =
  'modal-content rounded-2xl border-line shadow-card';
const MODAL_HEADER_CLASS = 'modal-header border-b-0 px-6 pb-1 pt-5';
const MODAL_BODY_CLASS = 'modal-body px-6 py-4';
const MODAL_FOOTER_CLASS = 'modal-footer gap-2 border-line px-6 pb-5 pt-4';

export default function MyJobPosts() {
  const { currentUser } = useAuth();
  const employerId = currentUser?.id;
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobPost | null>(null);

  const [assignTarget, setAssignTarget] = useState<JobPost | null>(null);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const [applicantsTarget, setApplicantsTarget] = useState<JobPost | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState('');
  const [reviewingApplication, setReviewingApplication] = useState<JobApplication | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);

  const [workers, setWorkers] = useState<User[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workersError, setWorkersError] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedReport, setSelectedReport] = useState<WorkerPerformanceReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportAttempt, setReportAttempt] = useState(0);
  const [profileReviewed, setProfileReviewed] = useState(false);

  const { toasts, pushToast, dismissToast } = useToast();

  const fetchJobs = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await jobApi.listJobs({ signal });
        const mine = (Array.isArray(data) ? data : [])
          // Only the signed-in employer's own postings.
          .filter((job) => String(job.employerId) === String(employerId))
          // Newest first (createdAt is ISO-8601, sorts lexicographically).
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setJobs(mine);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load your jobs. Please try again.';
          setLoadError(message);
          pushToast(message, 'error');
        }
      } finally {
        setLoading(false);
      }
    },
    [employerId, pushToast]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchJobs(controller.signal);
    return () => controller.abort();
  }, [fetchJobs]);

  // ------------------------------------------------------------------
  // Delete flow
  // ------------------------------------------------------------------
  const openDeleteModal = (job: JobPost) => {
    if (deletingId || assigningId) return;
    setAssignTarget(null);
    setDeleteTarget(job);
  };

  const closeDeleteModal = useCallback(() => {
    if (!deletingId) setDeleteTarget(null);
  }, [deletingId]);

  const executeDelete = async () => {
    if (!deleteTarget || deletingId) return;
    const job = deleteTarget;

    setDeletingId(job.id);
    try {
      await jobApi.deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      pushToast(`"${job.title}" was deleted.`);
    } catch (err) {
      pushToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to delete this job. Please try again.',
        'error'
      );
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  // ------------------------------------------------------------------
  // Applications flow (workers apply; employer reviews the profile, then
  // accepts — which assigns — or declines).
  // ------------------------------------------------------------------
  const loadApplications = useCallback(async (jobId: number, signal?: AbortSignal) => {
    setApplicationsLoading(true);
    setApplicationsError('');
    try {
      const data = await jobApi.getApplications(jobId, { signal });
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setApplicationsError(
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Unable to load applications.'
        );
      }
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  const openApplicantsModal = (job: JobPost) => {
    if (deletingId || assigningId || acceptingId) return;
    setAssignTarget(null);
    setReviewingApplication(null);
    setApplicantsTarget(job);
    setApplications([]);
    loadApplications(job.id);
  };

  const closeApplicantsModal = useCallback(() => {
    if (acceptingId || decliningId) return;
    setApplicantsTarget(null);
    setReviewingApplication(null);
  }, [acceptingId, decliningId]);

  const openReviewApplication = (application: JobApplication) => {
    if (acceptingId || decliningId) return;
    setReviewingApplication(application);
    setProfileReviewed(false);
    setSelectedWorkerId(String(application.workerId));
  };

  const executeAccept = async () => {
    if (!applicantsTarget || !reviewingApplication || !profileReviewed || acceptingId) return;
    const job = applicantsTarget;
    setAcceptingId(reviewingApplication.id);
    try {
      await jobApi.acceptApplication(job.id, reviewingApplication.id);
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'ASSIGNED' } : j))
      );
      pushToast(`Application accepted — worker assigned to "${job.title}".`);
      setApplicantsTarget(null);
      setReviewingApplication(null);
    } catch (err) {
      pushToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to accept the application.',
        'error'
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const executeDecline = async (application: JobApplication) => {
    if (!applicantsTarget || decliningId) return;
    const job = applicantsTarget;
    setDecliningId(application.id);
    try {
      await jobApi.declineApplication(job.id, application.id);
      setApplications((prev) =>
        prev.map((a) => (a.id === application.id ? { ...a, status: 'DECLINED' } : a))
      );
      pushToast('Application declined.');
    } catch (err) {
      pushToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to decline the application.',
        'error'
      );
    } finally {
      setDecliningId(null);
    }
  };

  // ------------------------------------------------------------------
  // Assign-worker flow
  // ------------------------------------------------------------------
  const openAssignModal = (job: JobPost) => {
    if (deletingId || assigningId) return;
    // Flip to the loading state synchronously so the modal never flashes a
    // stale worker list before the fetch effect runs.
    setWorkersLoading(true);
    setWorkersError('');
    setDeleteTarget(null);
    setAssignTarget(job);
  };

  const selectedWorker = workers.find((w) => String(w.id) === selectedWorkerId) || null;

  // Once the worker pool has loaded, hand focus to the picker.
  const workerSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (assignTarget && !workersLoading && !workersError && workers.length > 0) {
      workerSelectRef.current?.focus();
    }
  }, [assignTarget, workersLoading, workersError, workers.length]);

  const closeAssignModal = useCallback(() => {
    if (!assigningId) setAssignTarget(null);
  }, [assigningId]);

  const loadWorkers = useCallback(async (signal?: AbortSignal) => {
    setWorkersLoading(true);
    setWorkersError('');
    try {
      const data = await authApi.getWorkers({ signal });
      setWorkers(Array.isArray(data) ? data : []);
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

  // Load the worker pool each time the assign or applicants modal opens.
  useEffect(() => {
    if (!assignTarget && !applicantsTarget) return undefined;
    if (assignTarget) {
      setSelectedWorkerId('');
      setSelectedReport(null);
      setProfileReviewed(false);
    }
    const controller = new AbortController();
    loadWorkers(controller.signal);
    return () => controller.abort();
  }, [assignTarget, applicantsTarget, loadWorkers]);

  // When a worker is picked, fetch their performance profile so the employer
  // can review it (rating, review count, recent reviews) before assigning.
  useEffect(() => {
    if (!assignTarget || !selectedWorkerId) {
      setSelectedReport(null);
      setReportLoading(false);
      setReportError('');
      return undefined;
    }

    const controller = new AbortController();
    (async () => {
      setReportLoading(true);
      setReportError('');
      try {
        const data = await performanceApi.getWorkerPerformance(
          Number(selectedWorkerId),
          { signal: controller.signal }
        );
        setSelectedReport(data);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setReportError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load the worker profile.'
          );
        }
      } finally {
        setReportLoading(false);
      }
    })();

    return () => controller.abort();
  }, [assignTarget, selectedWorkerId, reportAttempt]);

  // Fetch the applicant's performance profile when the employer opens the
  // review view in the applications modal.
  useEffect(() => {
    if (!reviewingApplication?.workerId) {
      setSelectedReport(null);
      setReportLoading(false);
      setReportError('');
      return undefined;
    }

    const controller = new AbortController();
    (async () => {
      setReportLoading(true);
      setReportError('');
      try {
        const data = await performanceApi.getWorkerPerformance(
          reviewingApplication.workerId,
          { signal: controller.signal }
        );
        setSelectedReport(data);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setReportError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load the worker profile.'
          );
        }
      } finally {
        setReportLoading(false);
      }
    })();

    return () => controller.abort();
  }, [reviewingApplication]);

  const executeAssign = async () => {
    if (!assignTarget || !selectedWorkerId || !profileReviewed || assigningId) return;
    const job = assignTarget;

    setAssigningId(job.id);
    try {
      // Employers must review the worker's profile before assigning — the
      // backend only accepts the reviewed variant for EMPLOYER/ADMIN callers.
      await jobApi.assignWorkerReviewed(job.id, Number(selectedWorkerId));
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'ASSIGNED' } : j))
      );
      pushToast(`Worker assigned to "${job.title}".`);
      setAssignTarget(null);
    } catch (err) {
      pushToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to assign worker. Please try again.',
        'error'
      );
      // Keep the modal open so the employer can retry or cancel.
    } finally {
      setAssigningId(null);
    }
  };

  const busy = Boolean(deletingId) || Boolean(assigningId);

  return (
    <section aria-busy={loading}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header: count + create action */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-ink">My job posts</h3>
          {!loading && !loadError && (
            <p className="mt-0.5 text-sm text-ink-soft">{jobs.length} posting{jobs.length === 1 ? '' : 's'}</p>
          )}
        </div>
        <Link
          to="/employer/jobs/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
        >
          <Plus size={15} aria-hidden="true" />
          Post a job
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div data-testid="myjobs-loading" className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </Card>
          ))}
        </div>
      )}

      {/* Fetch error state */}
      {!loading && loadError && (
        <Card className="border-danger/30 bg-danger-soft/40">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-display text-base font-semibold text-ink">
                Couldn&apos;t load your jobs
              </h4>
              <p className="mt-0.5 text-sm text-ink-soft">{loadError}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => fetchJobs()}>
              Try again
            </Button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !loadError && jobs.length === 0 && (
        <EmptyState
          icon={<Briefcase size={26} />}
          title="No job posts yet"
          message="Post your first job and start matching with workers."
          action={
            <Link
              to="/employer/jobs/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
            >
              <Plus size={15} aria-hidden="true" />
              Post a job
            </Link>
          }
        />
      )}

      {/* Jobs table */}
      {!loading && !loadError && jobs.length > 0 && (
        <Card flush className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-5 py-3 font-bold">Job</th>
                  <th scope="col" className="px-5 py-3 font-bold">Location</th>
                  <th scope="col" className="px-5 py-3 font-bold">Wage/day</th>
                  <th scope="col" className="px-5 py-3 font-bold">Status</th>
                  <th scope="col" className="px-5 py-3 font-bold">Posted</th>
                  <th scope="col" className="px-5 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const isDeleting = deletingId === job.id;
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-line/70 transition-colors last:border-b-0 hover:bg-teal-100/30"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-ink">{job.title}</div>
                        <div className="mt-0.5 line-clamp-1 max-w-xs text-xs text-ink-soft">
                          {job.description}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-ink-soft">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} aria-hidden="true" />
                          {job.location}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-ink">
                        {formatWage(job.wagePerDay)}
                      </td>
                      <td className="px-5 py-4">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="px-5 py-4 text-ink-soft">{formatDate(job.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/employer/jobs/edit/${job.id}`)}
                            disabled={busy}
                          >
                            Edit
                          </Button>
                          {job.status === 'OPEN' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openAssignModal(job)}
                              disabled={busy}
                            >
                              Assign
                            </Button>
                          )}
                          {job.status === 'OPEN' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openApplicantsModal(job)}
                              disabled={busy || Boolean(acceptingId)}
                            >
                              Applicants
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openDeleteModal(job)}
                            disabled={busy}
                            isLoading={isDeleting}
                          >
                            {isDeleting ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <Modal onClose={closeDeleteModal} labelledBy="delete-job-modal-title">
          <div className={MODAL_CONTENT_CLASS}>
            <div className={MODAL_HEADER_CLASS}>
              <h5 className="modal-title font-display text-lg font-semibold text-ink" id="delete-job-modal-title">
                Delete job post
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeDeleteModal}
              />
            </div>
            <div className={MODAL_BODY_CLASS}>
              <p className="text-sm text-ink-soft">
                Are you sure you want to delete{' '}
                <strong className="text-ink">&quot;{deleteTarget.title}&quot;</strong>?
                This will remove the posting.
              </p>
            </div>
            <div className={MODAL_FOOTER_CLASS}>
              <Button
                type="button"
                variant="secondary"
                data-autofocus
                onClick={closeDeleteModal}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={executeDelete}
                disabled={Boolean(deletingId)}
                isLoading={Boolean(deletingId)}
              >
                {deletingId ? 'Deleting…' : 'Delete job'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign-worker modal */}
      {assignTarget && (
        <Modal onClose={closeAssignModal} labelledBy="assign-worker-modal-title">
          <div className={MODAL_CONTENT_CLASS}>
            <div className={MODAL_HEADER_CLASS}>
              <h5 className="modal-title font-display text-lg font-semibold text-ink" id="assign-worker-modal-title">
                Assign a worker
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeAssignModal}
              />
            </div>
            <div className={MODAL_BODY_CLASS}>
              <p className="mb-4 text-sm text-ink-soft">
                Pick a worker to assign to{' '}
                <strong className="text-ink">&quot;{assignTarget.title}&quot;</strong>.
              </p>

              {workersLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <p className="text-xs text-ink-soft">Loading available workers…</p>
                </div>
              ) : workersError ? (
                <div role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3">
                  <p className="mb-2 text-sm text-danger-text">{workersError}</p>
                  <Button variant="secondary" size="sm" onClick={() => loadWorkers()}>
                    Try again
                  </Button>
                </div>
              ) : workers.length === 0 ? (
                <p className="text-sm text-ink-soft">No active workers are available yet.</p>
              ) : (
                <Select
                  id="assign-worker-select"
                  ref={workerSelectRef}
                  data-autofocus
                  label="Worker"
                  value={selectedWorkerId}
                  onChange={(e) => {
                    setSelectedWorkerId(e.target.value);
                    setProfileReviewed(false);
                  }}
                >
                  <option value="">Select a worker…</option>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name} ({worker.email})
                    </option>
                  ))}
                </Select>
              )}

              {selectedWorkerId && (
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Worker profile
                    </span>
                    {!reportError && (
                      <Link
                        to={`/employer/workers/${selectedWorkerId}`}
                        className="text-xs font-medium text-teal-700 hover:text-teal-900"
                        onClick={closeAssignModal}
                      >
                        View full profile →
                      </Link>
                    )}
                  </div>
                  {reportError ? (
                    <div role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3">
                      <p className="mb-2 text-sm text-danger-text">{reportError}</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setReportAttempt((n) => n + 1)}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <WorkerProfileCard
                      report={selectedReport}
                      workerName={selectedWorker?.name}
                      loading={reportLoading}
                      compact
                    />
                  )}

                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-teal-700"
                      checked={profileReviewed}
                      onChange={(e) => setProfileReviewed(e.target.checked)}
                      disabled={reportLoading || Boolean(reportError)}
                    />
                    <span>
                      I have reviewed this worker&apos;s profile (rating, reviews
                      and attendance) before assigning them work.
                    </span>
                  </label>
                </div>
              )}
            </div>
            <div className={MODAL_FOOTER_CLASS}>
              <Button
                type="button"
                variant="secondary"
                onClick={closeAssignModal}
                disabled={Boolean(assigningId)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executeAssign}
                disabled={!selectedWorkerId || !profileReviewed || Boolean(assigningId)}
                isLoading={Boolean(assigningId)}
              >
                {assigningId
                  ? 'Assigning…'
                  : profileReviewed
                    ? 'Assign worker'
                    : 'Review profile to assign'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Applications modal: applicant list + review/accept/decline */}
      {applicantsTarget && (
        <Modal onClose={closeApplicantsModal} labelledBy="applicants-modal-title">
          <div className={MODAL_CONTENT_CLASS}>
            <div className={MODAL_HEADER_CLASS}>
              <h5 className="modal-title font-display text-lg font-semibold text-ink" id="applicants-modal-title">
                Applicants — {applicantsTarget.title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeApplicantsModal}
              />
            </div>
            <div className={MODAL_BODY_CLASS}>
              <p className="mb-4 text-xs text-ink-soft">
                Workers who applied to this job. Review a worker&apos;s profile
                before accepting.
              </p>

              {applicationsLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : applicationsError ? (
                <div role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3">
                  <p className="mb-2 text-sm text-danger-text">{applicationsError}</p>
                  <Button variant="secondary" size="sm" onClick={() => loadApplications(applicantsTarget.id)}>
                    Try again
                  </Button>
                </div>
              ) : applications.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  No applications yet — workers who apply will show up here.
                </p>
              ) : reviewingApplication ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Reviewing applicant
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setReviewingApplication(null)}
                      disabled={Boolean(acceptingId)}
                    >
                      ← Back to applicants
                    </Button>
                  </div>
                  <WorkerProfileCard
                    report={selectedReport}
                    workerName={
                      workers.find(
                        (w) => String(w.id) === String(reviewingApplication.workerId)
                      )?.name
                    }
                    loading={reportLoading}
                  />
                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-teal-700"
                      checked={profileReviewed}
                      onChange={(e) => setProfileReviewed(e.target.checked)}
                      disabled={reportLoading || Boolean(reportError)}
                    />
                    <span>
                      I have reviewed this worker&apos;s profile before accepting
                      their application.
                    </span>
                  </label>
                </div>
              ) : (
                <ul className="divide-y divide-line/70">
                  {applications.map((application) => {
                    const worker = workers.find(
                      (w) => String(w.id) === String(application.workerId)
                    );
                    const isDeclining = decliningId === application.id;
                    return (
                      <li
                        key={application.id}
                        className="flex flex-wrap items-center gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-ink">
                            {worker?.name || `Worker #${application.workerId}`}
                          </div>
                          <div className="text-xs text-ink-soft">
                            Applied {formatDate(application.createdAt)}
                          </div>
                        </div>
                        {application.status === 'PENDING' ? (
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => openReviewApplication(application)}
                              disabled={Boolean(acceptingId) || Boolean(decliningId)}
                            >
                              Review &amp; accept
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => executeDecline(application)}
                              disabled={Boolean(acceptingId) || Boolean(decliningId)}
                            >
                              {isDeclining ? 'Declining…' : 'Decline'}
                            </Button>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              application.status === 'ACCEPTED'
                                ? 'border-success/20 bg-success-soft text-success-text'
                                : 'border-line bg-line/50 text-ink-soft'
                            }`}
                          >
                            {application.status}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className={MODAL_FOOTER_CLASS}>
              <Button
                type="button"
                variant="secondary"
                onClick={closeApplicantsModal}
                disabled={Boolean(acceptingId) || Boolean(decliningId)}
              >
                Close
              </Button>
              {reviewingApplication && (
                <Button
                  type="button"
                  onClick={executeAccept}
                  disabled={!profileReviewed || Boolean(acceptingId)}
                  isLoading={Boolean(acceptingId)}
                >
                  {acceptingId
                    ? 'Accepting…'
                    : profileReviewed
                      ? 'Accept & assign worker'
                      : 'Review profile to accept'}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
