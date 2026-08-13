import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatWage } from '../../utils/jobFormat';
import { useToasts } from '../../hooks/useToasts';
import ToastStack from '../../components/ToastStack';
import JobStatusBadge from '../../components/JobStatusBadge';

export default function JobBrowse() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [applyingId, setApplyingId] = useState(null);
  const { toasts, pushToast, dismissToast } = useToasts();

  const fetchJobs = useCallback(async (signal) => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await axiosInstance.get('/api/jobs', { signal });
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      // Ignore cancelled requests (unmount / StrictMode remount in dev).
      if (err?.code !== 'ERR_CANCELED') {
        const message =
          err.response?.data?.message || 'Unable to load jobs. Please try again.';
        setLoadError(message);
        pushToast(message, 'danger');
      }
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    const controller = new AbortController();
    fetchJobs(controller.signal);
    return () => controller.abort();
  }, [fetchJobs]);

  const handleApply = async (job) => {
    if (!workerId || applyingId) return;

    setApplyingId(job.id);
    try {
      const { data } = await axiosInstance.post(
        `/api/jobs/${job.id}/assign/${workerId}`
      );
      // Reflect the new status in the grid immediately, no refetch needed.
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, status: data?.status || 'ASSIGNED' } : j
        )
      );
      pushToast(`Application sent — you're in line for "${job.title}".`);
    } catch (err) {
      const message =
        err.response?.data?.message || 'Unable to apply. Please try again.';
      pushToast(message, 'danger');
    } finally {
      setApplyingId(null);
    }
  };

  const openCount = jobs.filter((job) => job.status === 'OPEN').length;

  return (
    <section aria-busy={loading}>
      {/* Toast feedback (shared component) */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header: count + refresh */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">
          Available jobs{' '}
          {!loading && !loadError && (
            <span className="text-muted fw-normal">
              · {openCount} open of {jobs.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={fetchJobs}
          disabled={loading}
        >
          {loading ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              />
              Refreshing…
            </>
          ) : (
            'Refresh'
          )}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-5" data-testid="jobs-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading jobs…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching available jobs…</p>
        </div>
      )}

      {/* Fetch error state */}
      {!loading && loadError && (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load jobs</h4>
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
            <p className="fs-4 mb-1">🗂️</p>
            <h5 className="card-title">No jobs posted yet</h5>
            <p className="card-text text-muted mb-0">
              Check back soon — new opportunities are added regularly.
            </p>
          </div>
        </div>
      )}

      {/* Job card grid */}
      {!loading && !loadError && jobs.length > 0 && (
        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
          {jobs.map((job) => {
            const isOpen = job.status === 'OPEN';
            const isApplying = applyingId === job.id;
            const disabledNote =
              job.status === 'ASSIGNED'
                ? 'Already assigned'
                : job.status === 'CLOSED'
                ? 'Job closed'
                : '';

            return (
              <div className="col" key={job.id}>
                <div className="card job-card h-100 shadow-sm">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <h5 className="card-title mb-0">{job.title}</h5>
                      <JobStatusBadge
                        status={job.status}
                        className="flex-shrink-0"
                      />
                    </div>

                    <p className="card-text text-muted job-description">
                      {job.description}
                    </p>

                    <div className="mt-auto">
                      <div className="d-flex justify-content-between align-items-baseline border-top pt-3 mb-3">
                        <span className="fw-semibold text-primary fs-5">
                          {formatWage(job.wagePerDay)}
                          <span className="text-muted fw-normal small">/day</span>
                        </span>
                        <span className="text-muted small text-end">
                          {job.location}
                        </span>
                      </div>

                      {isOpen ? (
                        <button
                          type="button"
                          className="btn btn-primary w-100"
                          onClick={() => handleApply(job)}
                          disabled={Boolean(applyingId) || !workerId}
                        >
                          {isApplying ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-2"
                                aria-hidden="true"
                              />
                              Applying…
                            </>
                          ) : (
                            'Apply'
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline-secondary w-100"
                          disabled
                        >
                          {disabledNote}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </section>
  );
}
