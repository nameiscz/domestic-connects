// Shared formatting helpers and status metadata for job postings.
// Used by JobBrowse (workers) and MyJobPosts (employers).

// JobStatus → Bootstrap badge variant / human label.
export const STATUS_BADGE = {
  OPEN: 'success',
  ASSIGNED: 'warning',
  CLOSED: 'secondary',
};

export const STATUS_LABEL = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  CLOSED: 'Closed',
};

// INR formatter — hoisted so it is created once.
const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatWage = (wage) => {
  const value = Number(wage);
  return Number.isFinite(value) ? INR_FORMATTER.format(value) : '—';
};

export const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};
