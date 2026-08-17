import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi, authApi, jobApi } from '../../api';
import { formatWage } from '../../utils/jobFormat';
import { Button, Card, Input, Select, ToastStack, useToast } from '../../components/ui';
import Modal from '../../components/Modal';
import AttendanceReportView from '../../components/AttendanceReportView';
import type {
  AttendanceStatus,
  JobPost,
  User,
  WorkerAttendanceReport,
} from '../../types';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
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

interface MarkErrors {
  jobId?: string;
  markDate?: string;
  markStatus?: string;
}

export default function MarkAttendance() {
  const { currentUser } = useAuth();
  const employerId = currentUser?.id;
  const { toasts, pushToast, dismissToast } = useToast();

  const [workers, setWorkers] = useState<User[]>([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear());

  const [report, setReport] = useState<WorkerAttendanceReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportRefresh, setReportRefresh] = useState(0);

  const [markOpen, setMarkOpen] = useState(false);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [jobId, setJobId] = useState('');
  const [markDate, setMarkDate] = useState(todayISO());
  const [markStatus, setMarkStatus] = useState<AttendanceStatus>('PRESENT');
  const [markErrors, setMarkErrors] = useState<MarkErrors>({});
  const [marking, setMarking] = useState(false);
  const jobSelectRef = useRef<HTMLSelectElement>(null);

  // ------------------------------------------------------------------
  // Worker pool (employer-accessible GET /api/auth/workers)
  // ------------------------------------------------------------------
  const loadWorkers = useCallback(async (signal?: AbortSignal) => {
    setWorkersLoading(true);
    setWorkersError('');
    try {
      const list = await authApi.getWorkers({ signal });
      setWorkers(Array.isArray(list) ? list : []);
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
        const data = await attendanceApi.getWorkerAttendance(
          Number(selectedWorkerId),
          month,
          year,
          { signal: controller.signal }
        );
        setReport(data);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setReportError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load the attendance report.'
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
  const loadJobs = useCallback(
    async (signal?: AbortSignal) => {
      setJobsLoading(true);
      setJobsError('');
      setJobId('');
      try {
        const all = await jobApi.listJobs({ signal });
        // Attendance can only be marked against a job the employer has
        // already assigned to a worker.
        const mine = (Array.isArray(all) ? all : [])
          .filter((job) => String(job.employerId) === String(employerId))
          .filter((job) => job.status === 'ASSIGNED');
        setJobs(mine);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setJobsError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load your jobs. Please try again.'
          );
        }
      } finally {
        setJobsLoading(false);
      }
    },
    [employerId]
  );

  // Load the worker pool and the employer's ASSIGNED jobs together on mount.
  useEffect(() => {
    const controller = new AbortController();
    loadWorkers(controller.signal);
    loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadWorkers, loadJobs]);

  // Workers with an ASSIGNED job from this employer — the only workers the
  // employer may view and mark attendance for.
  const assignedWorkerIds = useMemo(() => {
    const ids = new Set<string>();
    jobs.forEach((job) => {
      if (job.workerId != null) ids.add(String(job.workerId));
    });
    return ids;
  }, [jobs]);

  const assignedWorkers = useMemo(
    () => workers.filter((w) => assignedWorkerIds.has(String(w.id))),
    [workers, assignedWorkerIds]
  );

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

  const validateMark = (): MarkErrors => {
    const next: MarkErrors = {};
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
      await attendanceApi.markAttendance({
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
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Unable to mark attendance. Please try again.',
        'error'
      );
      // Keep the modal open so the employer can adjust and retry.
    } finally {
      setMarking(false);
    }
  };

  return (
    <section aria-busy={reportLoading}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header: mark action */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl font-semibold text-ink">Mark attendance</h3>
        <Button
          type="button"
          size="sm"
          onClick={openMarkModal}
          disabled={!selectedWorkerId || marking}
        >
          + Mark attendance
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="attendance-worker" className="mb-1.5 block text-sm font-semibold text-ink">
              Worker
            </label>
            {workersLoading || jobsLoading ? (
              <div className="py-2 text-sm text-ink-soft">Loading workers…</div>
            ) : workersError || jobsError ? (
              <div
                className="rounded-xl border border-danger/30 bg-danger-soft/40 px-3 py-2 text-sm"
                role="alert"
              >
                <p className="mb-2 text-danger-text">{workersError || jobsError}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    loadWorkers();
                    loadJobs();
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : assignedWorkers.length === 0 ? (
              <div className="py-2 text-sm text-ink-soft">
                No assigned workers yet — assign a worker to one of your job
                posts to start marking attendance.
              </div>
            ) : (
              <select
                id="attendance-worker"
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
              >
                <option value="">Select a worker…</option>
                {assignedWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name} ({worker.email})
                  </option>
                ))}
              </select>
            )}
          </div>
          <Select
            id="attendance-month"
            label="Month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Select
            id="attendance-year"
            label="Year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Report */}
      {!selectedWorkerId ? (
        <Card className="py-10 text-center">
          <p className="mb-1 text-3xl" aria-hidden="true">
            👷
          </p>
          <h3 className="font-display text-lg font-semibold text-ink">
            Select a worker
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Choose a worker above to view and mark their monthly attendance.
          </p>
        </Card>
      ) : reportLoading ? (
        <div data-testid="report-loading" className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="mb-2 h-6 w-12 animate-pulse rounded-full bg-line" />
                <div className="h-3 w-16 animate-pulse rounded bg-line" />
              </div>
            ))}
          </div>
          <div className="h-64 rounded-2xl border border-line bg-white shadow-card" />
        </div>
      ) : reportError ? (
        <Card className="border-danger/30 bg-danger-soft/40">
          <h4 className="font-display text-base font-semibold text-ink">
            Couldn&apos;t load the report
          </h4>
          <p className="mt-1 text-sm text-ink-soft">{reportError}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setReportRefresh((r) => r + 1)}
          >
            Try again
          </Button>
        </Card>
      ) : (
        <AttendanceReportView
          report={report}
          emptyMessage={
            <>
              No records for {MONTHS[month - 1]?.label} {year}. Use{' '}
              <strong>Mark attendance</strong> to add the first one.
            </>
          }
        />
      )}

      {/* Mark-attendance modal */}
      {markOpen && (
        <Modal onClose={closeMarkModal} labelledBy="mark-attendance-modal-title">
          <div className="modal-content rounded-2xl border-0 shadow-card">
            <div className="modal-header rounded-t-2xl border-b border-line bg-white">
              <h5 className="modal-title font-display text-lg font-semibold text-ink" id="mark-attendance-modal-title">
                Mark attendance
              </h5>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-line/60"
                aria-label="Close"
                onClick={closeMarkModal}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-4 text-sm text-ink-soft">
                Record a day for <strong className="text-ink">{selectedWorker?.name}</strong>.
              </p>

              {jobsLoading ? (
                <div className="py-4 text-center">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" role="status" />
                  <p className="mt-2 mb-0 text-sm text-ink-soft">Loading your jobs…</p>
                </div>
              ) : jobsError ? (
                <div className="rounded-xl border border-danger/30 bg-danger-soft/40 px-3 py-2 text-sm" role="alert">
                  <p className="mb-2 text-danger-text">{jobsError}</p>
                  <Button type="button" variant="secondary" size="sm" onClick={() => loadJobs()}>
                    Try again
                  </Button>
                </div>
              ) : jobs.length === 0 ? (
                <p className="mb-0 text-sm text-ink-soft">
                  No assigned jobs to mark attendance against. Assign the
                  worker to a job first.
                </p>
              ) : (
                <div className="mb-4">
                  <label htmlFor="attendance-job" className="mb-1.5 block text-sm font-semibold text-ink">
                    Job
                  </label>
                  <select
                    id="attendance-job"
                    ref={jobSelectRef}
                    value={jobId}
                    onChange={(e) => {
                      setJobId(e.target.value);
                      if (markErrors.jobId) {
                        setMarkErrors((prev) => ({ ...prev, jobId: undefined }));
                      }
                    }}
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 ${markErrors.jobId ? 'border-danger' : 'border-line'}`}
                  >
                    <option value="">Select a job…</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} · {formatWage(job.wagePerDay)}/day
                      </option>
                    ))}
                  </select>
                  {markErrors.jobId && (
                    <p className="mt-1.5 text-xs font-medium text-danger-text" role="alert">
                      {markErrors.jobId}
                    </p>
                  )}
                </div>
              )}

              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="attendance-date" className="mb-1.5 block text-sm font-semibold text-ink">
                    Date
                  </label>
                  <Input
                    id="attendance-date"
                    type="date"
                    value={markDate}
                    max={todayISO()}
                    error={markErrors.markDate}
                    onChange={(e) => {
                      setMarkDate(e.target.value);
                      if (markErrors.markDate) {
                        setMarkErrors((prev) => ({ ...prev, markDate: undefined }));
                      }
                    }}
                  />
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-ink">Status</span>
                  <div role="radiogroup" aria-label="Status" className="flex gap-1.5">
                    {STATUS_OPTIONS.map((status) => {
                      const active = markStatus === status.value;
                      return (
                        <button
                          key={status.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => {
                            setMarkStatus(status.value);
                            if (markErrors.markStatus) {
                              setMarkErrors((prev) => ({ ...prev, markStatus: undefined }));
                            }
                          }}
                          className={[
                            'flex-1 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors',
                            active
                              ? status.value === 'PRESENT'
                                ? 'border-teal-700 bg-teal-700 text-white'
                                : status.value === 'HALF_DAY'
                                  ? 'border-marigold-600 bg-marigold-100 text-marigold-600'
                                  : 'border-danger bg-danger-soft text-danger-text'
                              : 'border-line bg-white text-ink-soft hover:border-teal-500/40',
                          ].join(' ')}
                        >
                          {status.label}
                        </button>
                      );
                    })}
                  </div>
                  {markErrors.markStatus && (
                    <p className="mt-1.5 text-xs font-medium text-danger-text" role="alert">
                      {markErrors.markStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer rounded-b-2xl border-t border-line bg-canvas/50 px-4 py-3">
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeMarkModal}
                  disabled={marking}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitMark}
                  disabled={marking}
                  isLoading={marking}
                >
                  {marking ? 'Saving…' : 'Save attendance'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
