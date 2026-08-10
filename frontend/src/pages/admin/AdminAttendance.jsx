import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import AttendanceReportView from '../../components/AttendanceReportView';

const MONTHS = [...Array(12)].map((_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

const currentYear = () => new Date().getFullYear();
const YEARS = [currentYear() - 1, currentYear(), currentYear() + 1];

/**
 * AdminAttendance — platform view of any worker's monthly attendance.
 * Admins pick a worker (GET /api/auth/workers) and a month/year, then see
 * the shared AttendanceReportView (summary cards + records table) fed by
 * GET /api/attendance/worker/{id}?month=&year=.
 */
export default function AdminAttendance() {
  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [workersError, setWorkersError] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear());

  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [refresh, setRefresh] = useState(0);

  // ------------------------------------------------------------------
  // Worker pool (shared by employers and admins: GET /api/auth/workers)
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
  }, [selectedWorkerId, month, year, refresh]);

  return (
    <section aria-busy={reportLoading}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">Worker attendance</h3>
        <span className="text-muted small">
          View any worker&apos;s monthly attendance
        </span>
      </div>

      {/* Filters: worker + month/year */}
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
              ) : workers.length === 0 ? (
                <p className="text-muted small mb-0">
                  No verified workers are available yet.
                </p>
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
              Choose a worker above to view their monthly attendance.
            </p>
          </div>
        </div>
      ) : reportLoading ? (
        <div className="text-center py-5" data-testid="admin-attendance-loading">
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
            onClick={() => setRefresh((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        <AttendanceReportView
          report={report}
          emptyMessage={
            <>
              No records for {MONTHS[month - 1]?.label} {year} for{' '}
              {selectedWorker?.name ?? 'this worker'} yet.
            </>
          }
        />
      )}
    </section>
  );
}
