import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  CalendarDays,
  Clock4,
  Download,
  IndianRupee,
  Printer,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { payrollApi } from '../../api';
import { formatDate, formatWage } from '../../utils/jobFormat';
import { Badge, Button, Card, CardHeader, Select } from '../../components/ui';
import type { SalaryRecord } from '../../types';

const MONTHS = [...Array(12)].map((_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

const currentYear = () => new Date().getFullYear();
const YEARS = [currentYear() - 1, currentYear(), currentYear() + 1];

const periodLabel = (month: number, year: number) =>
  `${MONTHS[month - 1]?.label} ${year}`;

const CHART_TOOLTIP_STYLE = {
  background: 'var(--dc-card)',
  border: '1px solid var(--dc-border)',
  borderRadius: 12,
  boxShadow: 'var(--dc-shadow-card)',
  color: 'var(--dc-ink)',
  fontSize: 12,
};

/** Triggers a browser download of the given blob via a temporary <a> tag. */
const triggerDownload = (blob: Blob, filename: string) => {
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
const blobToText = (blob: Blob): Promise<string> =>
  typeof blob.text === 'function'
    ? blob.text()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });

/**
 * Reads an error message out of a failed request. Because the slip is fetched
 * with responseType 'blob', error bodies are Blobs even though the backend
 * replies with JSON — read the blob and parse it to surface the real message
 * (e.g. "no attendance records for that month").
 */
const readErrorMessage = async (err: unknown): Promise<string | null> => {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await blobToText(data)) as { message?: string };
      if (parsed?.message) return parsed.message;
    } catch {
      // Not JSON (proxy/HTML error page) — fall through to generic message.
    }
  }
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || null
  );
};

interface DownloadPeriod {
  month: number;
  year: number;
}

/** Illustrated empty state — layered earnings shape, matches dashboard style. */
function PayrollEmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <div className="relative mb-6 h-28 w-28" aria-hidden="true">
        <div className="absolute inset-0 rotate-6 rounded-3xl bg-teal-100/80" />
        <div className="absolute inset-1.5 -rotate-3 rounded-2xl bg-white shadow-card" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Banknote size={40} strokeWidth={1.6} className="text-teal-600" />
        </div>
        <span className="absolute -right-1 top-0 h-4 w-4 rounded-full bg-marigold-400 ring-2 ring-white" />
        <span className="absolute -left-1.5 bottom-2 h-3 w-3 rounded-full bg-teal-300" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink">
        No salary slips available yet
      </h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
        Slips are generated from your monthly attendance. Once your employer
        marks attendance, you can download your first slip above.
      </p>
      <Link
        to="/worker/attendance"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-500 hover:shadow-lift"
      >
        <CalendarDays size={16} aria-hidden="true" />
        View Attendance
      </Link>
    </div>
  );
}

/** Earnings growth area chart (chronological). */
function EarningsChart({ records }: { records: SalaryRecord[] }) {
  const data = useMemo(
    () =>
      [...records]
        .sort((a, b) => a.year - b.year || a.month - b.month)
        .map((r) => ({
          period: `${MONTHS[r.month - 1]?.label.slice(0, 3) ?? r.month} ${String(r.year).slice(2)}`,
          earnings: r.grossSalary ?? 0,
        })),
    [records]
  );

  return (
    <div className="h-56" aria-label="Earnings growth over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--dc-teal-500)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--dc-teal-500)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--dc-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--dc-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            cursor={{ stroke: 'var(--dc-teal-500)', strokeDasharray: '3 3' }}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [formatWage(Number(value)), 'Earnings']}
          />
          <Area
            type="monotone"
            dataKey="earnings"
            stroke="var(--dc-teal-600)"
            strokeWidth={2.5}
            fill="url(#earningsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * MySalarySlips — the worker's payroll experience. Top summary cards, an
 * earnings-growth chart, a modern salary history table (month · amount ·
 * status · download) with PDF/CSV/Print actions, and an illustrated empty
 * state. PDF slips come from GET /api/payroll/{id}/slip, history from
 * GET /api/payroll/{id}/history.
 */
export default function MySalarySlips() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear());
  const [downloadingPeriod, setDownloadingPeriod] = useState<DownloadPeriod | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');

  const [history, setHistory] = useState<SalaryRecord[] | null>(null);
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
        const records = await payrollApi.getSalaryHistory(workerId, undefined, undefined, {
          signal: controller.signal,
        });
        setHistory(Array.isArray(records) ? records : []);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setHistoryError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load your salary history.'
          );
        }
      } finally {
        setHistoryLoading(false);
      }
    })();

    return () => controller.abort();
  }, [workerId, refresh]);

  // Summary metrics derived from the history.
  const summary = useMemo(() => {
    const records = history ?? [];
    const total = records.reduce((sum, r) => sum + (r.grossSalary ?? 0), 0);
    const monthsWithSlips = new Set(records.map((r) => `${r.year}-${r.month}`));
    // Pending = months in the last 6 with no generated slip yet.
    const now = new Date();
    let pending = 0;
    for (let i = 0; i < 6; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (!monthsWithSlips.has(`${d.getFullYear()}-${d.getMonth() + 1}`)) pending += 1;
    }
    const sorted = [...records].sort(
      (a, b) => b.year - a.year || b.month - a.month
    );
    const current = sorted[0]?.grossSalary ?? null;
    const average = records.length > 0 ? total / records.length : null;
    return {
      total,
      pending,
      current,
      average,
      months: records.length,
    };
  }, [history]);

  const handleDownload = async (downloadMonth: number, downloadYear: number) => {
    if (!workerId || downloading || exporting) return;

    const label = periodLabel(downloadMonth, downloadYear);
    setDownloadingPeriod({ month: downloadMonth, year: downloadYear });
    setError('');
    setSuccess('');
    setExportError('');
    setExportSuccess('');

    try {
      const file = await payrollApi.getSalarySlip(
        workerId,
        downloadMonth,
        downloadYear,
        currentUser?.name
      );
      triggerDownload(file.blob, file.filename);
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
      const file = await payrollApi.exportHistoryCsv(workerId);
      triggerDownload(file.blob, file.filename);
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

  /** Opens a print-ready view of the salary history (browser → Save as PDF). */
  const handlePrint = () => {
    const records = history ?? [];
    if (records.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;
    const rowHtml = records
      .map(
        (r) => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${periodLabel(r.month, r.year)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${r.presentDays ?? '—'} present · ${r.halfDays ?? '—'} half</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb"><strong>${r.grossSalary == null ? '—' : formatWage(r.grossSalary)}</strong></td>
        </tr>`
      )
      .join('');
    printWindow.document.write(`<!doctype html><html><head><title>Salary history</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;padding:32px;margin:0}
        h1{font-size:20px;margin:0 0 4px}
        p.sub{color:#64748b;font-size:13px;margin:0 0 20px}
        .cards{display:flex;gap:12px;margin-bottom:20px}
        .card{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
        .card .n{font-size:22px;font-weight:700}
        .card .l{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{text-align:left;padding:8px 12px;border-bottom:2px solid #e2e8f0;font-size:11px;text-transform:uppercase;color:#64748b}
        @media print{body{padding:0}}
      </style></head><body>
        <h1>Salary History</h1>
        <p class="sub">${currentUser?.name ?? 'Worker'} · Generated ${new Date().toLocaleDateString('en-IN')}</p>
        <div class="cards">
          <div class="card"><div class="n">${summary.total == null ? '—' : formatWage(summary.total)}</div><div class="l">Total earnings</div></div>
          <div class="card"><div class="n">${summary.average == null ? '—' : formatWage(summary.average)}</div><div class="l">Monthly average</div></div>
        </div>
        <table><thead><tr><th>Period</th><th>Attendance</th><th>Amount</th></tr></thead><tbody>${rowHtml}</tbody></table>
        <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
      </body></html>`);
    printWindow.document.close();
  };

  const isPeriodDownloading = (m: number, y: number) =>
    downloadingPeriod?.month === m && downloadingPeriod?.year === y;

  const historyRows = history ?? [];
  const hasHistory = !historyLoading && !historyError && historyRows.length > 0;

  return (
    <section aria-busy={downloading || exporting}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-2xl font-semibold text-ink">Payroll</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            Slips generated from your monthly attendance
          </p>
        </div>
      </div>

      {!workerId ? (
        <Card className="py-10 text-center">
          <p className="mb-1 text-3xl" aria-hidden="true">
            👷
          </p>
          <h2 className="font-display text-lg font-semibold text-ink">
            Account not recognised
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            We couldn&apos;t identify your account. Please sign in again.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 inline-flex rounded-xl bg-teal-100 p-2 text-teal-700" aria-hidden="true">
                <Wallet size={18} />
              </div>
              <div className="truncate font-display text-2xl font-bold text-ink">
                {summary.current == null ? '—' : formatWage(summary.current)}
              </div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Current month salary
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {summary.current == null ? 'No slip generated yet' : 'Most recent slip'}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 inline-flex rounded-xl bg-success-soft p-2 text-success-text" aria-hidden="true">
                <IndianRupee size={18} />
              </div>
              <div className="truncate font-display text-2xl font-bold text-ink">
                {summary.total === 0 ? '—' : formatWage(summary.total)}
              </div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Total earnings
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Across {summary.months} slip{summary.months === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 inline-flex rounded-xl bg-marigold-100 p-2 text-marigold-600" aria-hidden="true">
                <Clock4 size={18} />
              </div>
              <div className="font-display text-2xl font-bold text-ink">{summary.pending}</div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Pending payments
              </div>
              <p className="mt-1 text-xs text-ink-soft">Months without a slip (last 6)</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 inline-flex rounded-xl bg-marigold-100 p-2 text-marigold-600" aria-hidden="true">
                <TrendingUp size={18} />
              </div>
              <div className="truncate font-display text-2xl font-bold text-ink">
                {summary.average == null ? '—' : formatWage(summary.average)}
              </div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Average monthly income
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {summary.months > 0 ? `Per month over ${summary.months} slip${summary.months === 1 ? '' : 's'}` : 'No slips yet'}
              </p>
            </div>
          </div>

          {/* Month/year picker + PDF download */}
          <Card>
            <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <Select
                id="slip-month"
                label="Month"
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
              </Select>
              <Select
                id="slip-year"
                label="Year"
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
              </Select>
              <Button
                type="button"
                onClick={() => handleDownload(month, year)}
                disabled={downloading || exporting}
                data-testid="download-salary-slip"
              >
                {isPeriodDownloading(month, year) ? 'Generating…' : (
                  <>
                    <Download size={15} aria-hidden="true" />
                    Download PDF Slip
                  </>
                )}
              </Button>
            </div>
          </Card>

          {downloading && (
            <div className="py-4 text-center" data-testid="salary-slip-downloading">
              <span
                className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-teal-700 border-t-transparent"
                role="status"
              />
              <p className="mt-3 mb-0 text-sm text-ink-soft">
                Preparing your salary slip for{' '}
                {downloadingPeriod
                  ? periodLabel(downloadingPeriod.month, downloadingPeriod.year)
                  : periodLabel(month, year)}
                …
              </p>
            </div>
          )}

          {error && (
            <Card className="border-danger/30 bg-danger-soft/40" data-testid="salary-slip-error">
              <h4 className="font-display text-base font-semibold text-ink">
                Couldn&apos;t generate the slip
              </h4>
              <p className="mb-2 mt-1 text-sm text-ink-soft">{error}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleDownload(month, year)}
                disabled={downloading || exporting}
              >
                Try again
              </Button>
            </Card>
          )}

          {success && !error && (
            <Card
              className="border-success/30 bg-success-soft/50"
              data-testid="salary-slip-success"
            >
              <h4 className="font-display text-base font-semibold text-success-text">
                Download started
              </h4>
              <p className="mb-0 mt-1 text-sm text-ink-soft">{success}</p>
            </Card>
          )}

          {/* Earnings growth chart */}
          {hasHistory && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-teal-700" aria-hidden="true" />
                    Earnings growth
                  </span>
                }
                subtitle="Your monthly gross salary over time"
              />
              <EarningsChart records={historyRows} />
            </Card>
          )}

          {/* Salary history */}
          <Card flush>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
              <h4 className="font-display text-lg font-semibold text-ink">Salary history</h4>
              <div className="flex items-center gap-3">
                {hasHistory && (
                  <>
                    <span className="hidden text-sm text-ink-soft sm:inline">Newest first</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handlePrint}
                      disabled={exporting || downloading}
                    >
                      <Printer size={15} aria-hidden="true" />
                      Print
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={exporting || downloading}
                  data-testid="export-salary-history"
                >
                  {exporting ? 'Exporting…' : (
                    <>
                      <Download size={15} aria-hidden="true" />
                      Export CSV
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="p-5">
              {exportError && (
                <div
                  className="mb-3 rounded-xl border border-danger/30 bg-danger-soft/40 px-3 py-2 text-sm text-danger-text"
                  role="alert"
                  data-testid="csv-export-error"
                >
                  {exportError}
                </div>
              )}
              {exportSuccess && !exportError && (
                <div
                  className="mb-3 rounded-xl border border-success/30 bg-success-soft/50 px-3 py-2 text-sm text-success-text"
                  role="alert"
                  data-testid="csv-export-success"
                >
                  {exportSuccess}
                </div>
              )}
              {historyLoading && history === null ? (
                <div className="py-4 text-center" data-testid="salary-history-loading">
                  <span
                    className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent"
                    role="status"
                  />
                  <p className="mt-2 mb-0 text-sm text-ink-soft">
                    Fetching your salary history…
                  </p>
                </div>
              ) : historyError ? (
                <div
                  className="rounded-xl border border-danger/30 bg-danger-soft/40 px-3 py-2"
                  role="alert"
                  data-testid="salary-history-error"
                >
                  <p className="mb-2 text-sm text-danger-text">{historyError}</p>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setRefresh((r) => r + 1)}>
                    Try again
                  </Button>
                </div>
              ) : history && history.length === 0 ? (
                <PayrollEmptyState />
              ) : history && history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-soft">
                        <th scope="col" className="px-4 py-3 font-semibold">Month</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Amount</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Attendance</th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((record) => (
                        <tr
                          key={record.id ?? `${record.month}-${record.year}`}
                          className="border-b border-line last:border-b-0 hover:bg-canvas/50"
                        >
                          <td className="px-4 py-3">
                            <span className="font-semibold text-ink">
                              {periodLabel(record.month, record.year)}
                            </span>
                            <span className="block text-xs text-ink-soft">
                              Generated {formatDate(record.generatedAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-display text-base font-bold text-teal-700">
                              {record.grossSalary == null ? '—' : formatWage(record.grossSalary)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="success">
                              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                              Generated
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-ink-soft">
                            {record.presentDays ?? '—'} present · {record.halfDays ?? '—'} half
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDownload(record.month, record.year)}
                              disabled={downloading || exporting}
                              aria-label={`Download slip for ${periodLabel(record.month, record.year)}`}
                              data-testid={`download-slip-${record.month}-${record.year}`}
                            >
                              {isPeriodDownloading(record.month, record.year)
                                ? 'Generating…'
                                : (
                                  <>
                                    <Download size={14} aria-hidden="true" />
                                    Download
                                  </>
                                )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
