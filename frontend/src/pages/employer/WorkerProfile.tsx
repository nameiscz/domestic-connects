import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatWage } from '../../utils/jobFormat';
import { useToasts } from '../../hooks/useToasts';
import ToastStack from '../../components/ToastStack';
import WorkerProfileCard, { StarRow } from '../../components/WorkerProfileCard';
import type { JobPost, User, WorkerAttendanceReport, WorkerPerformanceReport } from '../../types';

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

/**
 * WorkerProfile — an employer-facing view of a worker's profile, shown before
 * assigning work: performance summary + review history (from
 * GET /api/performance/worker/{id}/history), this month's attendance (GET
 * /api/attendance/worker/{id}), and an "Assign to a job" action listing the
 * employer's OPEN postings. Assignment uses the reviewed endpoint, so the
 * backend records that the profile was checked.
 */
export default function WorkerProfile() {
  const { id } = useParams<{ id: string }>();
  const workerId = Number(id);
  const { currentUser } = useAuth();
  const employerId = currentUser?.id;
  const navigate = useNavigate();
  const { toasts, pushToast, dismissToast } = useToasts();

  const [worker, setWorker] = useState<User | null>(null);
  const [report, setReport] = useState<WorkerPerformanceReport | null>(null);
  const [attendance, setAttendance] = useState<WorkerAttendanceReport | null>(null);
  const [openJobs, setOpenJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const period = useMemo(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }, []);

  const load = useCallback(async () => {
    if (!Number.isInteger(workerId) || !employerId) return;
    setLoading(true);
    setError('');
    try {
      const [workersRes, reportRes, attendanceRes, jobsRes] = await Promise.allSettled([
        axiosInstance.get('/api/auth/workers'),
        axiosInstance.get(`/api/performance/worker/${workerId}/history?page=0&size=10`),
        axiosInstance.get(
          `/api/attendance/worker/${workerId}?month=${period.month}&year=${period.year}`
        ),
        axiosInstance.get('/api/jobs'),
      ]);

      const pool =
        workersRes.status === 'fulfilled' && Array.isArray(workersRes.value?.data?.data)
          ? workersRes.value.data.data
          : [];
      const found = pool.find((w: User) => String(w.id) === String(workerId));
      if (!found) {
        setError('Worker not found.');
      } else {
        setWorker(found);
      }

      if (reportRes.status === 'fulfilled') setReport(reportRes.value.data);
      if (attendanceRes.status === 'fulfilled') setAttendance(attendanceRes.value.data);
      const jobs =
        jobsRes.status === 'fulfilled' && Array.isArray(jobsRes.value?.data)
          ? jobsRes.value.data
          : [];
      setOpenJobs(
        jobs.filter(
          (job: JobPost) =>
            job.status === 'OPEN' && String(job.employerId) === String(employerId)
        )
      );
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to load the worker profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [workerId, employerId, period.month, period.year]);

  useEffect(() => {
    load();
  }, [load]);

  const executeAssign = async () => {
    if (!workerId || !selectedJobId || assigning) return;
    setAssigning(true);
    try {
      await axiosInstance.post(`/api/jobs/${selectedJobId}/assign/${workerId}/reviewed`);
      pushToast(`Worker assigned to the job.`);
      navigate('/employer/jobs');
    } catch (err) {
      pushToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to assign worker. Please try again.',
        'danger'
      );
    } finally {
      setAssigning(false);
    }
  };

  const reviews = report?.reviews ?? [];
  const attendanceSummary = attendance?.summary;

  return (
    <section aria-busy={loading}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">Worker profile</h3>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => navigate('/employer/jobs')}
        >
          ← Back to my jobs
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5" data-testid="worker-profile-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading profile…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching the worker profile…</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load the profile</h4>
          <p className="mb-2">{error}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={load}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Identity + summary */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-white">
              <h4 className="h6 mb-0">{worker?.name || `Worker #${workerId}`}</h4>
            </div>
            <div className="card-body">
              <div className="text-muted small mb-3">
                {worker?.email}
                {worker?.active === false && (
                  <span className="badge badge-soft-danger ms-2">Inactive</span>
                )}
              </div>
              <WorkerProfileCard report={report} workerName={worker?.name} />
            </div>
          </div>

          <div className="row g-3 mb-4">
            {/* Attendance this month */}
            <div className="col-lg-5">
              <div className="card shadow-sm h-100">
                <div className="card-header bg-white">
                  <h4 className="h6 mb-0">Attendance · {period.month}/{period.year}</h4>
                </div>
                <div className="card-body">
                  {attendanceSummary ? (
                    <div className="row text-center g-2">
                      <div className="col-3">
                        <div className="fs-4 fw-bold text-success">
                          {attendanceSummary.presentDays ?? 0}
                        </div>
                        <div className="text-muted small text-uppercase">Present</div>
                      </div>
                      <div className="col-3">
                        <div className="fs-4 fw-bold text-warning">
                          {attendanceSummary.halfDays ?? 0}
                        </div>
                        <div className="text-muted small text-uppercase">Half day</div>
                      </div>
                      <div className="col-3">
                        <div className="fs-4 fw-bold text-danger">
                          {attendanceSummary.absentDays ?? 0}
                        </div>
                        <div className="text-muted small text-uppercase">Absent</div>
                      </div>
                      <div className="col-3">
                        <div className="fs-4 fw-bold">{attendanceSummary.totalDays ?? 0}</div>
                        <div className="text-muted small text-uppercase">Total</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted small mb-0">
                      No attendance marked for this month yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Assign to a job */}
            <div className="col-lg-7">
              <div className="card shadow-sm h-100">
                <div className="card-header bg-white">
                  <h4 className="h6 mb-0">Assign to a job</h4>
                </div>
                <div className="card-body">
                  <p className="text-muted small">
                    Pick one of your open postings. The assignment is recorded as
                    profile-reviewed.
                  </p>
                  {openJobs.length === 0 ? (
                    <p className="text-muted small mb-0">
                      You have no open job postings right now — post a job first.
                    </p>
                  ) : (
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <select
                        className="appearance-none rounded-[10px] border border-black/[0.08] bg-white px-3 py-1.5 text-sm text-ink transition-all duration-200 hover:border-black/[0.15] focus:border-teal-500 focus:outline-none focus:ring-[3px] focus:ring-teal-500/15 focus:shadow-[0_0_0_3px_rgba(21,94,99,0.1)]"
                        style={{ maxWidth: 260 }}
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                        aria-label="Job to assign"
                      >
                        <option value="">Select an open job…</option>
                        {openJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title} · {formatWage(job.wagePerDay)}/day
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={executeAssign}
                        disabled={!selectedJobId || assigning}
                      >
                        {assigning ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-1"
                              aria-hidden="true"
                            />
                            Assigning…
                          </>
                        ) : (
                          'Assign this worker'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Review history */}
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h4 className="h6 mb-0">Review history</h4>
            </div>
            {reviews.length === 0 ? (
              <div className="card-body">
                <p className="text-muted small mb-0">
                  No reviews yet — this worker hasn&apos;t been rated on a job.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Rating</th>
                      <th>Remarks</th>
                      <th>Reviewed by</th>
                      <th>Job</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((review) => (
                      <tr key={review.id}>
                        <td>
                          <StarRow rating={review.rating} />
                          <span className="text-muted small ms-1">({review.rating}/5)</span>
                        </td>
                        <td className="text-muted">{review.remarks || '—'}</td>
                        <td>{review.reviewedBy || '—'}</td>
                        <td className="text-muted">#{review.jobId ?? '—'}</td>
                        <td className="text-muted">{formatDate(review.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}
    </section>
  );
}
