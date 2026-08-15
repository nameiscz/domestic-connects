import { STATUS_BADGE, STATUS_LABEL } from '../utils/jobFormat';

/**
 * Soft-tinted status pill for a JobStatus value (OPEN / ASSIGNED / CLOSED),
 * matching the design system's tag treatment. Unknown statuses fall back to a
 * neutral pill showing the raw value.
 *
 * Usage: <JobStatusBadge status={job.status} className="flex-shrink-0" />
 */
export default function JobStatusBadge({ status, className = '' }) {
  const variant = STATUS_BADGE[status] || 'secondary';
  const label = STATUS_LABEL[status] || status;

  return (
    <span
      className={`badge badge-soft-${variant} text-uppercase${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  );
}
