import { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import AttendanceReportView from '../../components/AttendanceReportView';

const MONTHS = [...Array(12)].map((_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

const currentYear = () => new Date().getFullYear();
const YEARS = [currentYear() - 1, currentYear(), currentYear() + 1];

/**
 * WorkerAttendance — a read-only view of the logged-in worker's own monthly
 * attendance (GET /api/attendance/worker/{id}?month=&year=). The backend only
 * permits WORKER callers to query their own id, so no picker is needed here.
 */
export default function WorkerAttendance() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(Boolean(workerId));
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!workerId) {
      setReport(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axiosInstance.get(
          `/api/attendance/worker/${workerId}?month=${month}&year=${year}`,
          { signal: controller.signal }
        );
        setReport(data);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setError(
            err.response?.data?.message || 'Unable to load your attendance.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [workerId, month, year, refresh]);

  return (
    <section aria-busy={loading}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">My attendance</h3>
        <span className="text-muted small">
          As recorded by your employer
        </span>
      </div>

      {/* Month/year filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
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

      {!workerId ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">👷</p>
            <h5 className="card-title">Account not recognised</h5>
            <p className="card-text text-muted mb-0">
              We couldn&apos;t identify your account. Please sign in again.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="text-center py-5" data-testid="attendance-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading attendance…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching your attendance…</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load your attendance</h4>
          <p className="mb-2">{error}</p>
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
              Your employer hasn&apos;t marked attendance for{' '}
              {MONTHS[month - 1]?.label} {year} yet.
            </>
          }
        />
      )}
    </section>
  );
}
