import { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatWage } from '../../utils/jobFormat';

const MONTHS = [...Array(12)].map((_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

const currentYear = () => new Date().getFullYear();
const YEARS = [currentYear() - 1, currentYear(), currentYear() + 1];

const periodLabel = (month, year) => `${MONTHS[month - 1]?.label} ${year}`;

/**
 * MySalarySlips — lets the logged-in worker download their monthly salary slip
 * as a PDF and re-download any slip from their persisted payroll history.
 *
 * Slips are fetched as authenticated blob requests
 * (GET /api/payroll/{workerId}/slip?month=&year= via the API gateway, which
 * strips the /api prefix and forwards to payroll-service). A plain <a href>
 * would not work here: the endpoint requires an `Authorization` header, so we
 * fetch with axios, wrap the response in an object URL, and trigger a download
 * through a temporary anchor element.
 *
 * History comes from GET /api/payroll/{workerId}/history (newest first) and is
 * refreshed after every download, since generating a slip persists a
 * SalaryRecord server-side.
 */

/** Pulls the suggested filename out of a Content-Disposition header, e.g.
 *  `attachment; filename="salary-slip-5-6-2026.pdf"`. Falls back otherwise. */
const parseFilename = (contentDisposition, fallback) => {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
};

/** Triggers a browser download of the given blob via a temporary <a> tag. */
const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer the revoke: some browsers (older Safari/Firefox) can cancel the
  // download if the object URL is released before the blob is picked up.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Reads a Blob as text — Blob.text() in real browsers, FileReader in jsdom. */
const blobToText = (blob) =>
  typeof blob.text === 'function'
    ? blob.text()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });

/**
 * Reads an error message out of a failed request. Because the slip is fetched
 * with responseType 'blob', error bodies are Blobs even though the backend
 * replies with JSON — read the blob and parse it to surface the real message
 * (e.g. "no attendance records for that month").
 */
const readErrorMessage = async (err) => {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await blobToText(data));
      if (parsed?.message) return parsed.message;
    } catch {
      // Not JSON (proxy/HTML error page) — fall through to generic message.
    }
  }
  return err.response?.data?.message || null;
};

export default function MySalarySlips() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear());
  // The period whose PDF is currently being generated (null when idle), so the
  // right row shows a spinner and nothing else can start in parallel.
  const [downloadingPeriod, setDownloadingPeriod] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');

  const [history, setHistory] = useState(null); // null = not loaded yet
  // Start loading as soon as we know who the worker is; the account-guard
  // branch renders instead when workerId is missing.
  const [historyLoading, setHistoryLoading] = useState(Boolean(workerId));
  const [historyError, setHistoryError] = useState('');
  const [refresh, setRefresh] = useState(0);

  const downloading = Boolean(downloadingPeriod);

  // Load the persisted salary history (newest first).
  useEffect(() => {
    if (!workerId) {
      setHistory(null);
      setHistoryLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    (async () => {
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const { data } = await axiosInstance.get(
          `/api/payroll/${workerId}/history`,
          { signal: controller.signal }
        );
        setHistory(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setHistoryError(
            err.response?.data?.message || 'Unable to load your salary history.'
          );
        }
      } finally {
        setHistoryLoading(false);
      }
    })();

    return () => controller.abort();
  }, [workerId, refresh]);

  const handleDownload = async (downloadMonth, downloadYear) => {
    if (!workerId || downloading || exporting) return;

    const label = periodLabel(downloadMonth, downloadYear);
    setDownloadingPeriod({ month: downloadMonth, year: downloadYear });
    setError('');
    setSuccess('');
    setExportError('');
    setExportSuccess('');

    try {
      const res = await axiosInstance.get(`/api/payroll/${workerId}/slip`, {
        params: { month: downloadMonth, year: downloadYear, workerName: currentUser?.name },
        // The backend answers with the raw PDF — keep it as a Blob so the
        // response interceptor and error handling stay binary-safe.
        responseType: 'blob',
      });

      // Prefer the filename the backend suggests (Content-Disposition,
      // e.g. salary-slip-5-6-2026.pdf); fall back to the friendly pattern.
      const filename = parseFilename(
        res.headers?.['content-disposition'],
        `salary-slip-${downloadMonth}-${downloadYear}.pdf`
      );

      triggerDownload(res.data, filename);
      setSuccess(`Salary slip for ${label} downloaded.`);
      // Generating a slip persists it server-side — refresh the history list.
      setRefresh((r) => r + 1);
    } catch (err) {
      const message = await readErrorMessage(err);
      setError(
        message ||
          `We couldn't generate your salary slip for ${label}. Please try again.`
      );
    } finally {
      setDownloadingPeriod(null);
    }
  };

  const handleExportCsv = async () => {
    if (!workerId || exporting || downloading) return;

    setExporting(true);
    setExportError('');
    setExportSuccess('');
    setError('');
    setSuccess('');

    try {
      // No month/year filters — the worker's full payroll history as CSV.
      const res = await axiosInstance.get(`/api/payroll/${workerId}/history/export`, {
        responseType: 'blob',
      });

      const filename = parseFilename(
        res.headers?.['content-disposition'],
        `salary-history-${workerId}.csv`
      );

      triggerDownload(res.data, filename);
      setExportSuccess('Your salary history has been exported as CSV.');
    } catch (err) {
      const message = await readErrorMessage(err);
      setExportError(
        message || "We couldn't export your salary history. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  const isPeriodDownloading = (m, y) =>
    downloadingPeriod?.month === m && downloadingPeriod?.year === y;

  return (
    <section aria-busy={downloading || exporting}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">My salary slips</h3>
        <span className="text-muted small">
          PDF slips generated from your monthly attendance
        </span>
      </div>

      {!workerId ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">👷</p>
            <h5 className="card-title">Account not recognised</h5>
            <p className="card-text text-muted mb-0">
              We couldn&apos;t identify your account. Please sign in again.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Month/year picker + download */}
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                <div className="col-6 col-md-3">
                  <label htmlFor="slip-month" className="form-label">
                    Month
                  </label>
                  <select
                    id="slip-month"
                    className="form-select"
                    value={month}
                    disabled={downloading}
                    onChange={(e) => {
                      setMonth(Number(e.target.value));
                      setError('');
                      setSuccess('');
                    }}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label htmlFor="slip-year" className="form-label">
                    Year
                  </label>
                  <select
                    id="slip-year"
                    className="form-select"
                    value={year}
                    disabled={downloading}
                    onChange={(e) => {
                      setYear(Number(e.target.value));
                      setError('');
                      setSuccess('');
                    }}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-auto">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleDownload(month, year)}
                    disabled={downloading || exporting}
                    data-testid="download-salary-slip"
                  >
                    {isPeriodDownloading(month, year) ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Generating…
                      </>
                    ) : (
                      <>⬇️ Download Salary Slip</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {downloading && (
            <div className="text-center py-4" data-testid="salary-slip-downloading">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Generating your salary slip…</span>
              </div>
              <p className="text-muted mt-3 mb-0">
                Preparing your salary slip for{' '}
                {downloadingPeriod
                  ? periodLabel(downloadingPeriod.month, downloadingPeriod.year)
                  : periodLabel(month, year)}
                …
              </p>
            </div>
          )}

          {error && (
            <div className="alert alert-danger shadow-sm" role="alert" data-testid="salary-slip-error">
              <h4 className="alert-heading h6">Couldn&apos;t generate the slip</h4>
              <p className="mb-2">{error}</p>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => handleDownload(month, year)}
                disabled={downloading || exporting}
              >
                Try again
              </button>
            </div>
          )}

          {success && !error && (
            <div className="alert alert-success shadow-sm" role="alert" data-testid="salary-slip-success">
              <h4 className="alert-heading h6">Download started</h4>
              <p className="mb-0">{success}</p>
            </div>
          )}

          {/* Salary history */}
          <div className="card shadow-sm">
            <div className="card-header bg-white d-flex flex-wrap align-items-center justify-content-between gap-2">
              <h4 className="h6 mb-0">Salary history</h4>
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">Newest first</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleExportCsv}
                  disabled={exporting || downloading}
                  data-testid="export-salary-history"
                >
                  {exporting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        role="status"
                        aria-hidden="true"
                      />
                      Exporting…
                    </>
                  ) : (
                    <>⬇️ Export CSV</>
                  )}
                </button>
              </div>
            </div>
            <div className="card-body">
              {exportError && (
                <div
                  className="alert alert-danger py-2 mb-3"
                  role="alert"
                  data-testid="csv-export-error"
                >
                  <small>{exportError}</small>
                </div>
              )}
              {exportSuccess && !exportError && (
                <div
                  className="alert alert-success py-2 mb-3"
                  role="alert"
                  data-testid="csv-export-success"
                >
                  <small>{exportSuccess}</small>
                </div>
              )}
              {/* Keep the table visible on refresh — only show the spinner
                  while nothing has been loaded yet. */}
              {historyLoading && history === null ? (
                <div className="text-center py-4" data-testid="salary-history-loading">
                  <div className="spinner-border text-primary spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading salary history…</span>
                  </div>
                  <p className="text-muted mt-2 mb-0 small">Fetching your salary history…</p>
                </div>
              ) : historyError ? (
                <div className="alert alert-danger mb-0" role="alert" data-testid="salary-history-error">
                  <p className="mb-2">{historyError}</p>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => setRefresh((r) => r + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : history && history.length === 0 ? (
                <div className="text-center py-4">
                  <p className="fs-4 mb-1" role="img" aria-hidden="true">🧾</p>
                  <h5 className="h6">No salary slips yet</h5>
                  <p className="text-muted small mb-0">
                    Download your first slip above — generated slips are saved
                    here for re-download.
                  </p>
                </div>
              ) : history && history.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Period</th>
                        <th>Present days</th>
                        <th>Half days</th>
                        <th>Gross salary</th>
                        <th>Generated</th>
                        <th className="text-end">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((record) => (
                        <tr key={record.id ?? `${record.month}-${record.year}`}>
                          <td className="fw-semibold">
                            {periodLabel(record.month, record.year)}
                          </td>
                          <td>{record.presentDays ?? '—'}</td>
                          <td>{record.halfDays ?? '—'}</td>
                          <td>
                            {record.grossSalary == null
                              ? '—'
                              : formatWage(record.grossSalary)}
                          </td>
                          <td className="text-muted">{formatDate(record.generatedAt)}</td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() =>
                                handleDownload(record.month, record.year)
                              }
                              disabled={downloading || exporting}
                              aria-label={`Download slip for ${periodLabel(record.month, record.year)}`}
                              data-testid={`download-slip-${record.month}-${record.year}`}
                            >
                              {isPeriodDownloading(record.month, record.year) ? (
                                <>
                                  <span
                                    className="spinner-border spinner-border-sm me-1"
                                    role="status"
                                    aria-hidden="true"
                                  />
                                  Generating…
                                </>
                              ) : (
                                <>⬇️ Download</>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
