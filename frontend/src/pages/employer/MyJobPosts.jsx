import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatWage, formatDate } from '../../utils/jobFormat';
import { useToasts } from '../../hooks/useToasts';
import ToastStack from '../../components/ToastStack';
import JobStatusBadge from '../../components/JobStatusBadge';
import Modal from '../../components/Modal';

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
  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workersError, setWorkersError] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [assigningId, setAssigningId] = useState(null);
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

  // Load the worker pool each time the assign modal opens.
  useEffect(() => {
    if (!assignTarget) return undefined;
    setSelectedWorkerId('');
    const controller = new AbortController();
    loadWorkers(controller.signal);
    return () => controller.abort();
  }, [assignTarget, loadWorkers]);

  const executeAssign = async () => {
    if (!assignTarget || !selectedWorkerId || assigningId) return;
    const job = assignTarget;

    setAssigningId(job.id);
    try {
      await axiosInstance.post(`/api/jobs/${job.id}/assign/${selectedWorkerId}`);
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
                              disabled={Boolean(deletingId) || Boolean(assigningId)}
                            >
                              Assign
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
                  No verified workers are available yet.
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
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
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
                disabled={!selectedWorkerId || Boolean(assigningId)}
              >
                {assigningId ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      aria-hidden="true"
                    />
                    Assigning…
                  </>
                ) : (
                  'Assign worker'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
