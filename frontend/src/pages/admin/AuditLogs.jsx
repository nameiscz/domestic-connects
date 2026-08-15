import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';

// Rows fetched per request. The backend paginates with 0-based `page` + `size`.
const PAGE_SIZE = 25;

// Microservices that write audit trails; shown in the service filter dropdown.
// Values are passed straight through as the `service` query param.
const SERVICE_OPTIONS = [
  'auth',
  'job',
  'attendance',
  'payroll',
  'review',
  'admin',
  'notification',
];

const EMPTY_FILTERS = { service: '', entityType: '', startDate: '', endDate: '' };

/**
 * Normalizes the ApiResponse-wrapped page payload into { items, hasMore, total }.
 *
 * Handles both a plain array and paginated envelopes (Spring-style
 * `{ content, totalElements, totalPages, last }` or `{ items, hasMore }`)
 * so the page keeps working whichever shape the service returns.
 */
const normalizePage = (payload) => {
  const body = payload?.data ?? payload ?? {};
  if (Array.isArray(body)) {
    return { items: body, hasMore: body.length === PAGE_SIZE, total: body.length };
  }
  const items = Array.isArray(body.content)
    ? body.content
    : Array.isArray(body.items)
      ? body.items
      : [];
  const hasMore =
    body.hasNext ??
    body.hasMore ??
    (typeof body.last === 'boolean' ? !body.last : items.length === PAGE_SIZE);
  return { items, hasMore, total: body.totalElements ?? body.total };
};

/** "2026-08-13T10:24:05Z" -> "13 Aug 2026, 3:54:05 pm" (local time). */
const formatTimestamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
};

/**
 * Collapses an old/new value into a compact single-line string for the table.
 * Objects and JSON-stringified payloads (the usual audit-log shape) are
 * stringified; null/empty values return null so the cell can show a dash.
 */
const summarizeValue = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

/**
 * AuditLogs — platform-wide audit trail (admin).
 *
 * Fetches the admin-service audit trail (GET /admin-service/admin/audit-logs,
 * exposed through the gateway as GET /api/admin/audit-logs, ApiResponse-wrapped)
 * with server-side filtering + pagination. Filters (service, entity type,
 * from/to date) are sent as query params and applied on submit; "Load more"
 * fetches the next page and appends it to the table.
 *
 * Query params: service, entityType, startDate, endDate, page (0-based), size.
 */
export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  const [refresh, setRefresh] = useState(0);

  // Draft filter values bound to the form controls.
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  // Applied filters — only changes when the admin clicks "Apply filters".
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [dateError, setDateError] = useState('');

  const updateDraft = (field) => (event) =>
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));

  const loadLogs = useCallback(async ({ targetPage, append, appliedFilters, signal }) => {
    if (append) {
      setLoadMoreError('');
    } else {
      setLoading(true);
      setLoadError('');
    }
    try {
      const params = {
        page: targetPage,
        size: PAGE_SIZE,
      };
      if (appliedFilters.service) params.service = appliedFilters.service;
      if (appliedFilters.entityType) params.entityType = appliedFilters.entityType;
      if (appliedFilters.startDate) params.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) params.endDate = appliedFilters.endDate;

      const { data } = await axiosInstance.get('/api/admin/audit-logs', {
        params,
        signal,
      });
      const next = normalizePage(data);
      setLogs((prev) => (append ? [...prev, ...next.items] : next.items));
      setTotal(next.total);
      setHasMore(next.hasMore);
      setPage(targetPage);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') {
        const message =
          err.response?.data?.message || 'Unable to load audit logs. Please try again.';
        if (append) {
          setLoadMoreError(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadLogs({ targetPage: 0, append: false, appliedFilters: filters, signal: controller.signal });
    return () => controller.abort();
  }, [loadLogs, filters, refresh]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadLogs({ targetPage: page + 1, append: true, appliedFilters: filters });
  };

  const applyFilters = () => {
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      setDateError('The from date must be on or before the to date.');
      return;
    }
    setDateError('');
    setFilters({
      service: draft.service,
      entityType: draft.entityType.trim(),
      startDate: draft.startDate,
      endDate: draft.endDate,
    });
  };

  const resetFilters = () => {
    setDateError('');
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  const hasActiveFilters =
    Boolean(filters.service) ||
    Boolean(filters.entityType) ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  return (
    <section aria-busy={loading || loadingMore}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">
          Audit Logs{' '}
          {!loading && !loadError && total != null && (
            <span className="text-muted fw-normal">
              · {total} entr{total === 1 ? 'y' : 'ies'}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => setRefresh((r) => r + 1)}
          disabled={loading || loadingMore}
        >
          Refresh
        </button>
      </div>

      {/* Filters: service, entity type, date range */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label htmlFor="audit-service" className="form-label">
                Service
              </label>
              <select
                id="audit-service"
                className="form-select"
                value={draft.service}
                onChange={updateDraft('service')}
              >
                <option value="">All services</option>
                {SERVICE_OPTIONS.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="audit-entity-type" className="form-label">
                Entity type
              </label>
              <input
                id="audit-entity-type"
                type="text"
                className="form-control"
                placeholder="e.g. USER, JOB, PAYROLL"
                value={draft.entityType}
                onChange={updateDraft('entityType')}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="audit-start-date" className="form-label">
                From date
              </label>
              <input
                id="audit-start-date"
                type="date"
                className="form-control"
                value={draft.startDate}
                max={draft.endDate || undefined}
                onChange={updateDraft('startDate')}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="audit-end-date" className="form-label">
                To date
              </label>
              <input
                id="audit-end-date"
                type="date"
                className="form-control"
                value={draft.endDate}
                min={draft.startDate || undefined}
                onChange={updateDraft('endDate')}
              />
            </div>
          </div>

          {dateError && (
            <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
              {dateError}
            </div>
          )}

          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={applyFilters}
              disabled={loading}
            >
              Apply filters
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={resetFilters}
              disabled={loading}
            >
              Reset
            </button>
            {hasActiveFilters && !loading && !loadError && (
              <span className="text-muted small">
                Showing logs for service &quot;{filters.service || 'any'}&quot;, entity type{' '}
                &quot;{filters.entityType || 'any'}&quot;
                {filters.startDate && `, from ${filters.startDate}`}
                {filters.endDate && ` to ${filters.endDate}`}.
              </span>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5" data-testid="audit-logs-loading">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading audit logs…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching audit logs…</p>
        </div>
      ) : loadError ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load audit logs</h4>
          <p className="mb-2">{loadError}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => setRefresh((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">🧾</p>
            <h5 className="card-title">
              {hasActiveFilters ? 'No matching audit logs' : 'No audit logs yet'}
            </h5>
            <p className="card-text text-muted mb-0">
              {hasActiveFilters
                ? 'Nothing matches these filters. Try widening the criteria.'
                : 'Platform events will appear here as they are recorded.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Entity type</th>
                  <th scope="col">Entity ID</th>
                  <th scope="col">Change summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => {
                  const oldText = summarizeValue(log.oldValue ?? log.before);
                  const newText = summarizeValue(log.newValue ?? log.after);
                  const changeSummary =
                    oldText == null && newText == null
                      ? null
                      : `${oldText == null ? '(none)' : oldText} → ${newText == null ? '(none)' : newText}`;
                  return (
                    <tr key={log.id ?? `${log.actor}-${log.timestamp}-${index}`}>
                      <td className="text-muted text-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="fw-semibold">{log.actor ?? '—'}</td>
                      <td>
                        <span className="badge badge-soft-secondary text-uppercase">
                          {log.action ?? '—'}
                        </span>
                      </td>
                      <td className="text-muted">{log.entityType ?? '—'}</td>
                      <td className="text-muted">#{log.entityId ?? '—'}</td>
                      <td style={{ maxWidth: 320 }}>
                        {changeSummary == null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span
                            className="small text-truncate d-inline-block"
                            style={{ maxWidth: '100%' }}
                            title={changeSummary}
                          >
                            <span className="text-muted">
                              {oldText == null ? '(none)' : oldText}
                            </span>
                            {' → '}
                            {newText == null ? '(none)' : newText}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card-footer text-center bg-white">
            {loadMoreError ? (
              <div className="d-flex flex-column align-items-center gap-2">
                <span className="text-danger small">{loadMoreError}</span>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  Try again
                </button>
              </div>
            ) : hasMore ? (
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={loadMore}
                disabled={loadingMore}
                data-testid="audit-logs-load-more"
              >
                {loadingMore ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      aria-hidden="true"
                    />
                    Loading more…
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            ) : (
              <span className="text-muted small">
                All {total ?? logs.length} entr{total === 1 ? 'y' : 'ies'} loaded.
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
