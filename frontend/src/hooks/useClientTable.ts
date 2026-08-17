import { useMemo, useState } from 'react';

export interface UseClientTableOptions<T> {
  /** Row fields matched case-insensitively as a substring against the query. */
  searchFields?: (keyof T)[];
  defaultPageSize?: number;
}

/**
 * Client-side search + pagination state for full-list admin tables.
 *
 * - `searchFields` are matched case-insensitively as a substring against the
 *   query; pass a module-level constant so the memo stays stable.
 * - Changing the query or page size resets to page 1.
 * - The active page is clamped to the valid range whenever the data shrinks
 *   (e.g. after a delete or a refresh), so the UI never shows an empty page.
 *
 * Returns:
 *   query, changeQuery(value)
 *   page, setPage(page), totalPages
 *   pageSize, changePageSize(size)
 *   filteredCount, pageRows
 */
export function useClientTable<T>(
  rows: T[],
  { searchFields = [], defaultPageSize = 10 }: UseClientTableOptions<T> = {}
) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      searchFields.some((field) => {
        const value = row[field];
        return value != null && String(value).toLowerCase().includes(normalizedQuery);
      })
    );
  }, [rows, normalizedQuery, searchFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const changeQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const changePageSize = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  return {
    query,
    changeQuery,
    page: safePage,
    setPage,
    pageSize,
    changePageSize,
    filteredCount: filtered.length,
    totalPages,
    pageRows,
  };
}
