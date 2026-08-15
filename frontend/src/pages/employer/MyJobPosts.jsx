import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatWage, formatDate } from '../../utils/jobFormat';
import { useToasts } from '../../hooks/useToasts';
import ToastStack from '../../components/ToastStack';
import JobStatusBadge from '../../components/JobStatusBadge';
import Modal from '../../components/Modal';
import WorkerProfileCard from '../../components/WorkerProfileCard';

export default function MyJobPosts() {
  const { currentUser } = useAuth();
  const employerId = currentUser?.id;
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [applicantsTarget, setApplicantsTarget] = useState(null);
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState('');
  const [reviewingApplication, setReviewingApplication] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workersError, setWorkersError] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [profileReviewed, setProfileReviewed] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);
  const { toasts, pushToast, dismissToast } = useToasts();

  const fetchJobs = useCallback(
    async (signal) => {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await axiosInstance.get('/api/jobs', { signal });
        const mine = (Array.isArray(data) ? data : [])
          // Only the signed-in employer's own postings.
          .filter((job) => String(job.employerId) === String(employerId))
          // Newest first (createdAt is ISO-8601, sorts lexicographically).
          .sort((a, b) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          );
        setJobs(mine);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          const message =
            err.response?.data?.message || 'Unable to load your jobs. Please try again.';
          setLoadError(message);
          pushToast(message, 'danger');
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
  const openDeleteModal = (job) => {
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
      await axiosInstance.delete(`/api/jobs/${job.id}`);
      // Remove from the list on success.
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      pushToast(`"${job.title}" was deleted.`);
    } catch (err) {
      pushToast(
        err.response?.data?.message || 'Unable to delete this job. Please try again.',
        'danger'
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
  const openApplicantsModal = (job) => {
    if (deletingId || assigningId || acceptingId) return;
    setAssignTarget(null);
    setReviewingApplication(null);
    setApplicantsTarget(job);
    setApplications([]);
    setApplicationsLoading(true);
    setApplicationsError('');
    loadApplications(job.id);
  };

  const closeApplicantsModal = useCallback(() => {
    if (acceptingId || decliningId) return;
    setApplicantsTarget(null);
    setReviewingApplication(null);
  }, [acceptingId, decliningId]);

  const loadApplications = useCallback(async (jobId, signal) => {
    setApplicationsLoading(true);
    setApplicationsError('');
    try {
      const { data } = await axiosInstance.get(`/api/jobs/${jobId}/applications`, {
        signal,
      });
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') {
        setApplicationsError(
          err.response?.data?.message || 'Unable to load applications.'
        );
      }
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  const openReviewApplication = (application) => {
    if (acceptingId || decliningId) return;
    setReviewingApplication(application);
    setProfileReviewed(false);
    setSelectedWorkerId(application.workerId);
  };

  const executeAccept = async () => {
    if (!applicantsTarget || !reviewingApplication || !profileReviewed || acceptingId) return;
    const job = applicantsTarget;
    setAcceptingId(reviewingApplication.id);
    try {
      await axiosInstance.post(
        `/api/jobs/${job.id}/applications/${reviewingApplication.id}/accept`
      );
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'ASSIGNED' } : j))
      );
      pushToast(`Application accepted — worker assigned to "${job.title}".`);
      setApplicantsTarget(null);
      setReviewingApplication(null);
    } catch (err) {
      pushToast(
        err.response?.data?.message || 'Unable to accept the application.',
        'danger'
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const executeDecline = async (application) => {
    if (!applicantsTarget || decliningId) return;
    const job = applicantsTarget;
    setDecliningId(application.id);
    try {
      await axiosInstance.post(
        `/api/jobs/${job.id}/applications/${application.id}/decline`
      );
      setApplications((prev) =>
        prev.map((a) =>
          a.id === application.id ? { ...a, status: 'DECLINED' } : a
        )
      );
      pushToast('Application declined.');
    } catch (err) {
      pushToast(
        err.response?.data?.message || 'Unable to decline the application.',
        'danger'
      );
    } finally {
      setDecliningId(null);
    }
  };

  // ------------------------------------------------------------------
  // Assign-worker flow
  // ------------------------------------------------------------------
  const openAssignModal = (job) => {
    if (deletingId || assigningId) return;
    // Flip to the loading state synchronously so the modal never flashes a
    // stale worker list or the empty state before the fetch effect runs.
    setWorkersLoading(true);
    setWorkersError('');
    setDeleteTarget(null);
    setAssignTarget(job);
  };

  const selectedWorker =
    workers.find((w) => String(w.id) === String(selectedWorkerId)) || null;

  // Once the worker pool has loaded, hand focus to the picker (the modal's
  // mount-time data-autofocus can't reach it — it renders after the fetch).
  const workerSelectRef = useRef(null);
  useEffect(() => {
    if (assignTarget && !workersLoading && !workersError && workers.length > 0) {
      workerSelectRef.current?.focus();
    }
  }, [assignTarget, workersLoading, workersError, workers.length]);

  const closeAssignModal = useCallback(() => {
    if (!assigningId) setAssignTarget(null);
  }, [assigningId]);

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
        const { data } = await axiosInstance.get(
          `/api/performance/worker/${selectedWorkerId}`,
          { signal: controller.signal }
        );
        setSelectedReport(data);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setReportError(
            err.response?.data?.message || 'Unable to load the worker profile.'
          );
        }
      } finally {
        setReportLoading(false);
      }
    })();

    return () => controller.abort();
  }, [assignTarget, selectedWorkerId]);

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
        const { data } = await axiosInstance.get(
          `/api/performance/worker/${reviewingApplication.workerId}`,
          { signal: controller.signal }
        );
        setSelectedReport(data);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setReportError(
            err.response?.data?.message || 'Unable to load the worker profile.'
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
      await axiosInstance.post(
        `/api/jobs/${job.id}/assign/${selectedWorkerId}/reviewed`
      );
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'ASSIGNED' } : j))
      );
      pushToast(`Worker assigned to "${job.title}".`);
      setAssignTarget(null);
    } catch (err) {
      pushToast(
        err.response?.data?.message || 'Unable to assign worker. Please try again.',
        'danger'
      );
      // Keep the modal open so the employer can retry or cancel.
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <section aria-busy={loading}>
      {/* Toast feedback (shared component) */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header: count + create action */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">
          My job posts{' '}
          {!loading && !loadError && (
            <span className="text-muted fw-normal">· {jobs.length}</span>
          )}
        </h3>
        <Link to="/employer/jobs/new" className="btn btn-primary btn-sm">
          + Post a job
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-5" data-testid="myjobs-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading your jobs…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching your job posts…</p>
        </div>
      )}

      {/* Fetch error state */}
      {!loading && loadError && (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load your jobs</h4>
          <p className="mb-2">{loadError}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={fetchJobs}
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !loadError && jobs.length === 0 && (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">📋</p>
            <h5 className="card-title">No job posts yet</h5>
            <p className="card-text text-muted mb-3">
              Post your first job and start matching with workers.
            </p>
            <Link to="/employer/jobs/new" className="btn btn-primary btn-sm">
              + Post a job
            </Link>
          </div>
        </div>
      )}

      {/* Jobs table */}
      {!loading && !loadError && jobs.length > 0 && (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Location</th>
                  <th scope="col">Wage/day</th>
                  <th scope="col">Status</th>
                  <th scope="col">Posted</th>
                  <th scope="col" className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const isDeleting = deletingId === job.id;
                  return (
                    <tr key={job.id}>
                      <td>
                        <div className="fw-semibold">{job.title}</div>
                        <div className="text-muted small text-truncate" style={{ maxWidth: 320 }}>
                          {job.description}
                        </div>
                      </td>
                      <td className="text-muted">{job.location}</td>
                      <td className="fw-semibold">{formatWage(job.wagePerDay)}</td>
                      <td>
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="text-muted">{formatDate(job.createdAt)}</td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => navigate(`/employer/jobs/edit/${job.id}`)}
                            disabled={Boolean(deletingId) || Boolean(assigningId)}
                          >
                            Edit
                          </button>
                          {job.status === 'OPEN' && (
                            <button
                              type="button"
                              className="btn btn-outline-success btn-sm"
                              onClick={() => openAssignModal(job)}
                              disabled={
                                Boolean(deletingId) || Boolean(assigningId)
                              }
                            >
                              Assign
                            </button>
                          )}
                          {job.status === 'OPEN' && (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => openApplicantsModal(job)}
                              disabled={
                                Boolean(deletingId) ||
                                Boolean(assigningId) ||
                                Boolean(acceptingId)
                              }
                            >
                              Applicants
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => openDeleteModal(job)}
                            disabled={Boolean(deletingId) || Boolean(assigningId)}
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <Modal onClose={closeDeleteModal} labelledBy="delete-job-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="delete-job-modal-title">
                Delete job post
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
                Are you sure you want to delete{' '}
                <strong>&quot;{deleteTarget.title}&quot;</strong>? This will
                remove the posting.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                data-autofocus
                className="btn btn-outline-secondary"
                onClick={closeDeleteModal}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={executeDelete}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      aria-hidden="true"
                    />
                    Deleting…
                  </>
                ) : (
                  'Delete job'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign-worker modal */}
      {assignTarget && (
        <Modal onClose={closeAssignModal} labelledBy="assign-worker-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="assign-worker-modal-title">
                Assign a worker
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeAssignModal}
              />
            </div>
            <div className="modal-body">
              <p className="text-muted mb-3">
                Pick a worker to assign to{' '}
                <strong>&quot;{assignTarget.title}&quot;</strong>.
              </p>

              {workersLoading ? (
                <div className="text-center py-4">
                  <span
                    className="spinner-border spinner-border-sm text-primary"
                    role="status"
                  >
                    <span className="visually-hidden">Loading workers…</span>
                  </span>
                  <p className="text-muted small mt-2 mb-0">
                    Loading available workers…
                  </p>
                </div>
              ) : workersError ? (
                <div className="alert alert-danger py-2 mb-0" role="alert">
                  <p className="mb-2">{workersError}</p>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={loadWorkers}
                  >
                    Try again
                  </button>
                </div>
              ) : workers.length === 0 ? (
                <p className="text-muted mb-0">
                  No active workers are available yet.
                </p>
              ) : (
                <div>
                  <label htmlFor="assign-worker-select" className="form-label">
                    Worker
                  </label>
                  <select
                    id="assign-worker-select"
                    ref={workerSelectRef}
                    data-autofocus
                    className="form-select"
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
                  </select>
                </div>
              )}

              {selectedWorkerId && (
                <div className="mt-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted small text-uppercase">
                      Worker profile
                    </span>
                    {reportError ? (
                      <span className="text-danger small">{reportError}</span>
                    ) : (
                      <Link
                        to={`/employer/workers/${selectedWorkerId}`}
                        className="small"
                        onClick={closeAssignModal}
                      >
                        View full profile →
                      </Link>
                    )}
                  </div>
                  {reportError ? (
                    <div className="alert alert-danger py-2 mb-0" role="alert">
                      <p className="mb-2 small">{reportError}</p>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => setSelectedWorkerId((v) => `${v}`)}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <WorkerProfileCard
                      report={selectedReport}
                      workerName={selectedWorker?.name}
                      loading={reportLoading}
                      compact
                    />
                  )}

                  <div className="form-check mt-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="profile-reviewed-check"
                      checked={profileReviewed}
                      onChange={(e) => setProfileReviewed(e.target.checked)}
                      disabled={reportLoading || Boolean(reportError)}
                    />
                    <label
                      className="form-check-label small"
                      htmlFor="profile-reviewed-check"
                    >
                      I have reviewed this worker&apos;s profile (rating, reviews
                      and attendance) before assigning them work.
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeAssignModal}
                disabled={Boolean(assigningId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={executeAssign}
                disabled={
                  !selectedWorkerId || !profileReviewed || Boolean(assigningId)
                }
              >
                {assigningId ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      aria-hidden="true"
                    />
                    Assigning…
                  </>
                ) : profileReviewed ? (
                  'Assign worker'
                ) : (
                  'Review profile to assign'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Applications modal: applicant list + review/accept/decline */}
      {applicantsTarget && (
        <Modal
          onClose={closeApplicantsModal}
          labelledBy="applicants-modal-title"
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="applicants-modal-title">
                Applicants — {applicantsTarget.title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeApplicantsModal}
              />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">
                Workers who applied to this job. Review a worker&apos;s profile
                before accepting.
              </p>

              {applicationsLoading ? (
                <div className="text-center py-4">
                  <span
                    className="spinner-border spinner-border-sm text-primary"
                    role="status"
                  >
                    <span className="visually-hidden">Loading applications…</span>
                  </span>
                  <p className="text-muted small mt-2 mb-0">
                    Loading applications…
                  </p>
                </div>
              ) : applicationsError ? (
                <div className="alert alert-danger py-2 mb-0" role="alert">
                  <p className="mb-2">{applicationsError}</p>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => loadApplications(applicantsTarget.id)}
                  >
                    Try again
                  </button>
                </div>
              ) : applications.length === 0 ? (
                <p className="text-muted mb-0">
                  No applications yet — workers who apply will show up here.
                </p>
              ) : reviewingApplication ? (
                /* Review the selected applicant's profile, then accept */
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted small text-uppercase">
                      Reviewing applicant
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setReviewingApplication(null)}
                      disabled={Boolean(acceptingId)}
                    >
                      ← Back to applicants
                    </button>
                  </div>
                  <WorkerProfileCard
                    report={selectedReport}
                    workerName={
                      workers.find(
                        (w) =>
                          String(w.id) ===
                          String(reviewingApplication.workerId)
                      )?.name
                    }
                    loading={reportLoading}
                  />
                  <div className="form-check mt-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="application-reviewed-check"
                      checked={profileReviewed}
                      onChange={(e) => setProfileReviewed(e.target.checked)}
                      disabled={reportLoading || Boolean(reportError)}
                    />
                    <label
                      className="form-check-label small"
                      htmlFor="application-reviewed-check"
                    >
                      I have reviewed this worker&apos;s profile before accepting
                      their application.
                    </label>
                  </div>
                </div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {applications.map((application) => {
                    const worker = workers.find(
                      (w) => String(w.id) === String(application.workerId)
                    );
                    const isDeclining = decliningId === application.id;
                    return (
                      <li
                        key={application.id}
                        className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom"
                      >
                        <div className="flex-grow-1">
                          <div className="fw-semibold">
                            {worker?.name || `Worker #${application.workerId}`}
                          </div>
                          <div className="text-muted small">
                            Applied {formatDate(application.createdAt)}
                          </div>
                        </div>
                        {application.status === 'PENDING' ? (
                          <div className="d-inline-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() =>
                                openReviewApplication(application)
                              }
                              disabled={
                                Boolean(acceptingId) || Boolean(decliningId)
                              }
                            >
                              Review &amp; accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => executeDecline(application)}
                              disabled={
                                Boolean(acceptingId) || Boolean(decliningId)
                              }
                            >
                              {isDeclining ? 'Declining…' : 'Decline'}
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`badge ${
                              application.status === 'ACCEPTED'
                                ? 'badge-soft-success'
                                : 'badge-soft-secondary'
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
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeApplicantsModal}
                disabled={Boolean(acceptingId) || Boolean(decliningId)}
              >
                Close
              </button>
              {reviewingApplication && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={executeAccept}
                  disabled={!profileReviewed || Boolean(acceptingId)}
                >
                  {acceptingId ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        aria-hidden="true"
                      />
                      Accepting…
                    </>
                  ) : profileReviewed ? (
                    'Accept & assign worker'
                  ) : (
                    'Review profile to accept'
                  )}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
