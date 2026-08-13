/**
 * DashboardChart — Bootstrap card shell for an analytics chart or KPI panel:
 * a titled card on a 2-column grid slot (`.col-lg-6`), with an optional
 * empty-state message replacing the content.
 *
 * Renders its own column wrapper, matching StatCard's convention. Pass
 * `bodyClassName` (e.g. `d-flex flex-column justify-content-center`) when the
 * content should be vertically centered or needs extra body styling.
 */
export default function DashboardChart({ title, emptyMessage = '', bodyClassName = '', children }) {
  return (
    <div className="col-lg-6">
      <div className="card shadow-sm h-100">
        <div className="card-header bg-white">
          <h4 className="h6 mb-0">{title}</h4>
        </div>
        <div className={`card-body ${bodyClassName}`}>
          {emptyMessage ? (
            <p className="text-muted small mb-0">{emptyMessage}</p>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
