import { STATUS_BADGE, STATUS_LABEL } from '../utils/jobFormat';

/**
 * Colored Bootstrap badge for a JobStatus value (OPEN / ASSIGNED / CLOSED).
 * Unknown statuses fall back to a neutral badge showing the raw value.
 *
 * Usage: <JobStatusBadge status={job.status} className="flex-shrink-0" />
 */
export default function JobStatusBadge({ status, className = '' }) {
  const variant = STATUS_BADGE[status] || 'secondary';
  const label = STATUS_LABEL[status] || status;

  return (
    <span
      className={`badge bg-${variant} text-uppercase${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  );
}
