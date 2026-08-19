import { Search } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export interface TableToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder: string;
  count: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

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
}: TableToolbarProps) {
  const start = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div className="relative" style={{ maxWidth: 300 }}>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true">
          <Search size={15} strokeWidth={2.4} />
        </span>
        <input
          type="search"
          className="w-full rounded-[14px] border border-black/[0.08] bg-card py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink-soft/50 transition-all duration-200 hover:border-black/[0.15] dark:border-white/[0.08] dark:hover:border-white/[0.15] focus:border-teal-500 focus:outline-none focus:ring-[3px] focus:ring-teal-500/15 focus:shadow-[0_0_0_3px_rgba(21,94,99,0.1)]"
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
          className="appearance-none rounded-[10px] border border-black/[0.08] bg-card px-3 py-1.5 text-sm text-ink transition-all duration-200 hover:border-black/[0.15] dark:border-white/[0.08] dark:hover:border-white/[0.15] focus:border-teal-500 focus:outline-none focus:ring-[3px] focus:ring-teal-500/15 focus:shadow-[0_0_0_3px_rgba(21,94,99,0.1)]"
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
