import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { formatWage, formatDate } from '../../utils/jobFormat';
import JobStatusBadge from '../../components/JobStatusBadge';
import { useToasts } from '../../hooks/useToasts';
import { useClientTable } from '../../hooks/useClientTable';
import ToastStack from '../../components/ToastStack';
import TableToolbar from '../../components/TableToolbar';
import Modal from '../../components/Modal';
import type { JobPost } from '../../types';

// Fields matched by the table search (module-level so the hook memo is stable).
const JOB_SEARCH_FIELDS: (keyof JobPost)[] = [
  'title',
  'description',
  'employerId',
  'location',
  'status',
];

/**
 * JobManagement — platform-wide job management (admin).
 *
 * Fetches every job posting from the admin-service aggregator
 * (GET /admin-service/admin/jobs, exposed through the gateway as
 * GET /api/admin/jobs, ApiResponse-wrapped) and lets an ADMIN soft-delete a
 * posting via the job-service endpoint (DELETE /api/jobs/{id}, ADMIN role
 * allowed). Soft-deleted posts are hidden from every query, so the row is
 * removed from the table on success.
 */
export default function JobManagement() {
  const { toasts, pushToast, dismissToast } = useToasts();

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobPost | null>(null);
  const [refresh, setRefresh] = useState(0);

  const {
    query,
    changeQuery,
    page,
    setPage,
    pageSize,
    changePageSize,
    filteredCount,
    totalPages,
    pageRows,
  } = useClientTable(jobs, { searchFields: JOB_SEARCH_FIELDS });

  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await axiosInstance.get('/api/admin/jobs', { signal });
      setJobs(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setLoadError(
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Unable to load jobs. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadJobs, refresh]);

  const openDeleteModal = (job: JobPost) => {
    if (deletingId) return;
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
      // Soft-delete endpoint on job-service (DELETE /jobs/{id}). The post
      // stays in the database but is hidden from every query, so dropping
      // the row locally keeps the table in sync with the backend.
      await axiosInstance.delete(`/api/jobs/${job.id}`);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      pushToast(`"${job.title}" was deleted.`);
    } catch (err) {
      pushToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to delete this job. Please try again.',
        'danger'
      );
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const openCount = jobs.filter((job) => job.status === 'OPEN').length;
  const showToolbar = !loading && !loadError && jobs.length > 0;

  return (
    <section aria-busy={loading || Boolean(deletingId)}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">
          Jobs{' '}
          {!loading && !loadError && (
            <span className="text-muted fw-normal">
              · {openCount} open of {jobs.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => setRefresh((r) => r + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {showToolbar && (
        <TableToolbar
          query={query}
          onQueryChange={changeQuery}
          searchPlaceholder="Search by title, employer, location or status…"
          count={filteredCount}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={changePageSize}
        />
      )}

      {loading ? (
        <div className="text-center py-5" data-testid="job-management-loading">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading jobs…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching jobs…</p>
        </div>
      ) : loadError ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load jobs</h4>
          <p className="mb-2">{loadError}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => setRefresh((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">🗂️</p>
            <h5 className="card-title">No jobs posted yet</h5>
            <p className="card-text text-muted mb-0">
              Employer postings will appear here.
            </p>
          </div>
        </div>
      ) : filteredCount === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">🔍</p>
            <h5 className="card-title">No matching jobs</h5>
            <p className="card-text text-muted mb-0">
              Nothing matches &quot;{query}&quot;. Try a different search.
            </p>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Employer</th>
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
                {pageRows.map((job) => {
                  const isDeleting = deletingId === job.id;
                  return (
                    <tr key={job.id}>
                      <td>
                        <div className="fw-semibold">{job.title}</div>
                        <div
                          className="text-muted small text-truncate"
                          style={{ maxWidth: 320 }}
                        >
                          {job.description}
                        </div>
                      </td>
                      <td className="text-muted">#{job.employerId ?? '—'}</td>
                      <td className="text-muted">{job.location}</td>
                      <td className="fw-semibold">{formatWage(job.wagePerDay)}</td>
                      <td>
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="text-muted">{formatDate(job.createdAt)}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => openDeleteModal(job)}
                          disabled={Boolean(deletingId)}
                          title="Soft-delete this job posting"
                          data-testid={`delete-${job.id}`}
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
                remove the posting from the platform.
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
    </section>
  );
}
