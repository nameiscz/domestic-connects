// Shared formatting helpers and status metadata for job postings.
// Used by JobBrowse (workers) and MyJobPosts (employers).

// JobStatus → Bootstrap badge variant / human label.
export const STATUS_BADGE: Record<string, string> = {
  OPEN: 'success',
  ASSIGNED: 'warning',
  CLOSED: 'secondary',
};

export const STATUS_LABEL: Record<string, string> = {
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

export const formatWage = (wage: number | string | null | undefined): string => {
  const value = Number(wage);
  return Number.isFinite(value) ? INR_FORMATTER.format(value) : '—';
};

/**
 * Plain INR number (no ₹ glyph) — for pills/stat values that already show a
 * rupee icon. Rendering the ₹ text glyph next to digits in the display serif
 * makes the symbol's diagonal stroke read like a strikethrough.
 */
export const formatWageNumber = (wage: number | string | null | undefined): string => {
  const value = Number(wage);
  return Number.isFinite(value)
    ? new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value)
    : '—';
};

export const formatDate = (value: string | number | Date): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};
