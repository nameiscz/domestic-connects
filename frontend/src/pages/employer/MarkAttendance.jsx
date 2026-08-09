import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatWage } from '../../utils/jobFormat';
import { useToasts } from '../../hooks/useToasts';
import ToastStack from '../../components/ToastStack';
import Modal from '../../components/Modal';
import AttendanceReportView from '../../components/AttendanceReportView';

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'HALF_DAY', label: 'Half day' },
  { value: 'ABSENT', label: 'Absent' },
];

const MONTHS = [...Array(12)].map((_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

const currentYear = () => new Date().getFullYear();
const YEARS = [currentYear() - 1, currentYear(), currentYear() + 1];

// Today's date as YYYY-MM-DD in the user's local timezone.
const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export default function MarkAttendance() {
  const { currentUser } = useAuth();
  const employerId = currentUser?.id;
  const { toasts, pushToast, dismissToast } = useToasts();

  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear());

  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportRefresh, setReportRefresh] = useState(0);

  const [markOpen, setMarkOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [jobId, setJobId] = useState('');
  const [markDate, setMarkDate] = useState(todayISO());
  const [markStatus, setMarkStatus] = useState('PRESENT');
  const [markErrors, setMarkErrors] = useState({});
  const [marking, setMarking] = useState(false);
  const jobSelectRef = useRef(null);

  // ------------------------------------------------------------------
  // Worker pool (employer-accessible GET /api/auth/workers)
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

  useEffect(() => {
    const controller = new AbortController();
    loadWorkers(controller.signal);
    return () => controller.abort();
  }, [loadWorkers]);

  const selectedWorker =
    workers.find((w) => String(w.id) === String(selectedWorkerId)) || null;

  // ------------------------------------------------------------------
  // Monthly report for the selected worker
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
          `/api/attendance/worker/${selectedWorkerId}?month=${month}&year=${year}`,
          { signal: controller.signal }
        );
        setReport(data);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setReportError(
            err.response?.data?.message || 'Unable to load the attendance report.'
          );
        }
      } finally {
        setReportLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedWorkerId, month, year, reportRefresh]);

  // ------------------------------------------------------------------
  // Mark-attendance modal — the employer's own ASSIGNED jobs
  // ------------------------------------------------------------------
  const loadJobs = useCallback(async (signal) => {
    setJobsLoading(true);
    setJobsError('');
    setJobId('');
    try {
      const { data } = await axiosInstance.get('/api/jobs', { signal });
      // Attendance can only be marked against a job the employer has
      // already assigned to a worker.
      const mine = (Array.isArray(data) ? data : [])
        .filter((job) => String(job.employerId) === String(employerId))
        .filter((job) => job.status === 'ASSIGNED');
      setJobs(mine);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') {
        setJobsError(
          err.response?.data?.message || 'Unable to load your jobs. Please try again.'
        );
      }
    } finally {
      setJobsLoading(false);
    }
  }, [employerId]);

  useEffect(() => {
    if (!markOpen) return undefined;
    const controller = new AbortController();
    loadJobs(controller.signal);
    return () => controller.abort();
  }, [markOpen, loadJobs]);

  // Once jobs load, hand focus to the picker.
  useEffect(() => {
    if (markOpen && !jobsLoading && !jobsError && jobs.length > 0) {
      jobSelectRef.current?.focus();
    }
  }, [markOpen, jobsLoading, jobsError, jobs.length]);

  const openMarkModal = () => {
    setMarkDate(todayISO());
    setMarkStatus('PRESENT');
    setMarkErrors({});
    setMarkOpen(true);
  };

  const closeMarkModal = useCallback(() => {
    if (!marking) setMarkOpen(false);
  }, [marking]);

  const validateMark = () => {
    const next = {};
    if (!jobId) next.jobId = 'Select a job.';
    if (!markDate) next.markDate = 'Date is required.';
    if (!markStatus) next.markStatus = 'Status is required.';
    return next;
  };

  const submitMark = async () => {
    if (!selectedWorkerId || marking) return;

    const next = validateMark();
    setMarkErrors(next);
    if (Object.keys(next).length > 0) return;

    setMarking(true);
    try {
      await axiosInstance.post('/api/attendance/mark', {
        workerId: Number(selectedWorkerId),
        jobId: Number(jobId),
        date: markDate,
        status: markStatus,
      });
      pushToast(
        `Attendance marked for ${selectedWorker?.name ?? 'the worker'} on ${markDate}.`
      );
      setMarkOpen(false);
      setReportRefresh((r) => r + 1);
    } catch (err) {
      pushToast(
        err.response?.data?.message || 'Unable to mark attendance. Please try again.',
        'danger'
      );
      // Keep the modal open so the employer can adjust and retry.
    } finally {
      setMarking(false);
    }
  };

  return (
    <section aria-busy={reportLoading}>
      {/* Toast feedback (shared component) */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header: mark action */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">Mark attendance</h3>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openMarkModal}
          disabled={!selectedWorkerId || marking}
        >
          + Mark attendance
        </button>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="attendance-worker" className="form-label">
                Worker
              </label>
              {workersLoading ? (
                <div className="text-muted small py-2">Loading workers…</div>
              ) : workersError ? (
                <div className="alert alert-danger py-2 mb-0" role="alert">
                  <p className="mb-2">{workersError}</p>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => loadWorkers()}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <select
                  id="attendance-worker"
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
              )}
            </div>
            <div className="col-6 col-md-3">
              <label htmlFor="attendance-month" className="form-label">
                Month
              </label>
              <select
                id="attendance-month"
                className="form-select"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label htmlFor="attendance-year" className="form-label">
                Year
              </label>
              <select
                id="attendance-year"
                className="form-select"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
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
              Choose a worker above to view and mark their monthly attendance.
            </p>
          </div>
        </div>
      ) : reportLoading ? (
        <div className="text-center py-5" data-testid="report-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading attendance…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching the attendance report…</p>
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
      ) : (
        <AttendanceReportView
          report={report}
          emptyMessage={
            <>No records for {MONTHS[month - 1]?.label} {year}. Use{' '}
              <strong>Mark attendance</strong> to add the first one.</>
          }
        />
      )}

      {/* Mark-attendance modal */}
      {markOpen && (
        <Modal onClose={closeMarkModal} labelledBy="mark-attendance-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="mark-attendance-modal-title">
                Mark attendance
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeMarkModal}
              />
            </div>
            <div className="modal-body">
              <p className="text-muted mb-3">
                Record a day for <strong>{selectedWorker?.name}</strong>.
              </p>

              {jobsLoading ? (
                <div className="text-center py-4">
                  <span
                    className="spinner-border spinner-border-sm text-primary"
                    role="status"
                  >
                    <span className="visually-hidden">Loading jobs…</span>
                  </span>
                  <p className="text-muted small mt-2 mb-0">Loading your jobs…</p>
                </div>
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
              ) : jobs.length === 0 ? (
                <p className="text-muted mb-0">
                  No assigned jobs to mark attendance against. Assign the
                  worker to a job first.
                </p>
              ) : (
                <div className="mb-3">
                  <label htmlFor="attendance-job" className="form-label">
                    Job
                  </label>
                  <select
                    id="attendance-job"
                    ref={jobSelectRef}
                    className={`form-select ${markErrors.jobId ? 'is-invalid' : ''}`}
                    value={jobId}
                    onChange={(e) => {
                      setJobId(e.target.value);
                      if (markErrors.jobId) {
                        setMarkErrors((prev) => ({ ...prev, jobId: undefined }));
                      }
                    }}
                  >
                    <option value="">Select a job…</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} · {formatWage(job.wagePerDay)}/day
                      </option>
                    ))}
                  </select>
                  {markErrors.jobId && (
                    <div className="invalid-feedback">{markErrors.jobId}</div>
                  )}
                </div>
              )}

              <div className="row g-3 mb-3">
                <div className="col-sm-6">
                  <label htmlFor="attendance-date" className="form-label">
                    Date
                  </label>
                  <input
                    id="attendance-date"
                    type="date"
                    className={`form-control ${markErrors.markDate ? 'is-invalid' : ''}`}
                    value={markDate}
                    max={todayISO()}
                    onChange={(e) => {
                      setMarkDate(e.target.value);
                      if (markErrors.markDate) {
                        setMarkErrors((prev) => ({ ...prev, markDate: undefined }));
                      }
                    }}
                  />
                  {markErrors.markDate && (
                    <div className="invalid-feedback">{markErrors.markDate}</div>
                  )}
                </div>
                <div className="col-sm-6">
                  <label htmlFor="attendance-status" className="form-label">
                    Status
                  </label>
                  <select
                    id="attendance-status"
                    className="form-select"
                    value={markStatus}
                    onChange={(e) => setMarkStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeMarkModal}
                disabled={marking}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitMark}
                disabled={marking}
              >
                {marking ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  'Save attendance'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
