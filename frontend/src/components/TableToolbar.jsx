const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Search + paging controls for full-list admin tables. Pairs with the
 * `useClientTable` hook; renders a search box, a "Showing X–Y of Z" count,
 * a rows-per-page selector and Prev/Next paging buttons.
 */
export default function TableToolbar({
  query,
  onQueryChange,
  searchPlaceholder,
  count,
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
}) {
  const start = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div className="input-group input-group-sm" style={{ maxWidth: 300 }}>
        <span className="input-group-text" aria-hidden="true">
          🔍
        </span>
        <input
          type="search"
          className="form-control"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label={searchPlaceholder}
        />
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="text-muted small" data-testid="table-count">
          {count === 0 ? 'No matches' : `Showing ${start}–${end} of ${count}`}
        </span>

        <select
          className="form-select form-select-sm"
          style={{ width: 'auto' }}
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>

        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ‹ Prev
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled>
            Page {page} of {totalPages}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
}
