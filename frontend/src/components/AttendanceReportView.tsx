import type { ReactNode } from 'react';
import { formatDate } from '../utils/jobFormat';
import { Badge } from './ui/Badge';
import type { WorkerAttendanceReport } from '../types';

// AttendanceStatus → badge variant / human label.
const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
};

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger'> = {
  PRESENT: 'success',
  HALF_DAY: 'warning',
  ABSENT: 'danger',
};

const formatDateTime = (value: string) => {
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

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: 'bg-success-soft text-success-text',
    warning: 'bg-marigold-100 text-marigold-600',
    danger: 'bg-danger-soft text-danger-text',
    neutral: 'bg-line/50 text-ink-soft',
  };
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <div
        className={`mb-1 inline-flex rounded-full px-2.5 py-0.5 text-sm font-bold ${toneClasses[tone]}`}
      >
        {value}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </div>
    </div>
  );
}

/**
 * Shared renderer for a {@code WorkerAttendanceReport}: the monthly summary
 * cards and the records table (or an empty state when there are no records).
 * Used by the employer's MarkAttendance page and the worker's own
 * MyAttendance page.
 */
export default function AttendanceReportView({
  report,
  emptyMessage,
}: {
  report: WorkerAttendanceReport | null;
  emptyMessage: ReactNode;
}) {
  const records = report?.records ?? [];
  const summary = report?.summary;

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card py-12 text-center shadow-card">
        <p className="mb-1 text-3xl" aria-hidden="true">
          📅
        </p>
        <h3 className="font-display text-lg font-semibold text-ink">
          No attendance yet
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryStat label="Present" value={summary?.presentDays ?? 0} tone="success" />
        <SummaryStat label="Half days" value={summary?.halfDays ?? 0} tone="warning" />
        <SummaryStat label="Absent" value={summary?.absentDays ?? 0} tone="danger" />
        <SummaryStat label="Total" value={summary?.totalDays ?? 0} tone="neutral" />
      </div>

      {/* Records table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-soft">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Marked at
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-line last:border-b-0 hover:bg-canvas/50">
                  <td className="px-5 py-3 font-medium text-ink">{formatDate(record.date)}</td>
                  <td className="px-5 py-3">
                    <Badge variant={STATUS_BADGE[record.status] ?? 'neutral'}>
                      {STATUS_LABEL[record.status] ?? record.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{formatDateTime(record.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
