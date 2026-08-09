/**
 * Shared Bootstrap stat card for dashboard overviews: an emoji, a headline
 * value, an uppercase label and an optional footnote. The optional `sample`
 * flag renders a small "sample" badge for placeholder values.
 *
 * Renders its own `.stat-card` hover-lift style so consumers don't duplicate
 * the scoped <style> block (the browser dedupes identical rules).
 */
export default function StatCard({
  emoji,
  label,
  value,
  note,
  accent = 'primary',
  sample = false,
}) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card stat-card shadow-sm h-100">
        <div className="card-body d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="fs-4" role="img" aria-hidden="true">
              {emoji}
            </span>
            {sample && (
              <span className="badge bg-light text-muted border small">
                sample
              </span>
            )}
          </div>
          <div className={`fs-4 fw-bold text-${accent} mb-0`}>{value}</div>
          <div className="text-muted small text-uppercase">{label}</div>
          {note && <div className="text-muted small mt-auto pt-1">{note}</div>}
        </div>
      </div>

      <style>{`
        .stat-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.10) !important; }
      `}</style>
    </div>
  );
}
