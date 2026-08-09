import { formatDate } from '../utils/jobFormat';

// AttendanceStatus → badge variant / human label.
const STATUS_LABEL = {
  PRESENT: 'Present',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
};

const STATUS_BADGE = {
  PRESENT: 'success',
  HALF_DAY: 'warning',
  ABSENT: 'danger',
};

const formatDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

function SummaryStat({ label, value, variant }) {
  return (
    <div className="col-6 col-md-3">
      <div className="card shadow-sm h-100">
        <div className="card-body py-3">
          <div className={`fs-4 fw-bold text-${variant}`}>{value}</div>
          <div className="text-muted small text-uppercase">{label}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared renderer for a {@code WorkerAttendanceReport}: the monthly summary
 * cards and the records table (or an empty state when there are no records).
 * Used by the employer's MarkAttendance page and the worker's own
 * WorkerAttendance page.
 */
export default function AttendanceReportView({ report, emptyMessage }) {
  const records = report?.records ?? [];
  const summary = report?.summary;

  if (records.length === 0) {
    return (
      <div className="card shadow-sm">
        <div className="card-body text-center py-5">
          <p className="fs-4 mb-1">📅</p>
          <h5 className="card-title">No attendance yet</h5>
          <p className="card-text text-muted mb-0">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Summary */}
      <div className="row g-3 mb-4">
        <SummaryStat label="Present" value={summary?.presentDays ?? 0} variant="success" />
        <SummaryStat label="Half days" value={summary?.halfDays ?? 0} variant="warning" />
        <SummaryStat label="Absent" value={summary?.absentDays ?? 0} variant="danger" />
        <SummaryStat label="Total" value={summary?.totalDays ?? 0} variant="secondary" />
      </div>

      {/* Records table */}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Status</th>
                <th scope="col">Marked at</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.date)}</td>
                  <td>
                    <span
                      className={`badge bg-${
                        STATUS_BADGE[record.status] || 'secondary'
                      } text-uppercase`}
                    >
                      {STATUS_LABEL[record.status] || record.status}
                    </span>
                  </td>
                  <td className="text-muted">{formatDateTime(record.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
