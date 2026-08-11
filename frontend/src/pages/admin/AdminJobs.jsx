import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { formatWage, formatDate } from '../../utils/jobFormat';
import JobStatusBadge from '../../components/JobStatusBadge';

/**
 * AdminJobs — platform-wide view of every job posting
 * (GET /api/admin/jobs via the admin-service aggregator, ApiResponse-wrapped).
 * Read-only for now; per-job management stays with the owning employer.
 */
export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);

  const loadJobs = useCallback(async (signal) => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await axiosInstance.get('/api/admin/jobs', { signal });
      setJobs(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') {
        setLoadError(
          err.response?.data?.message || 'Unable to load jobs. Please try again.'
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

  const openCount = jobs.filter((job) => job.status === 'OPEN').length;

  return (
    <section aria-busy={loading}>
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

      {loading ? (
        <div className="text-center py-5" data-testid="admin-jobs-loading">
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
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
