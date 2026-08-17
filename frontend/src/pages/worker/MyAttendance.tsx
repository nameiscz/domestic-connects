import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Flame,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi } from '../../api';
import { formatDate } from '../../utils/jobFormat';
import { Badge, Button, Card, CardHeader, Select, Skeleton, ToastStack, useToast } from '../../components/ui';
import type { Attendance, AttendanceStatus, WorkerAttendanceReport } from '../../types';

const MONTHS = [...Array(12)].map((_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

const currentYear = () => new Date().getFullYear();
const YEARS = [currentYear() - 1, currentYear(), currentYear() + 1];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
};

const STATUS_BADGE: Record<AttendanceStatus, 'success' | 'warning' | 'danger'> = {
  PRESENT: 'success',
  HALF_DAY: 'warning',
  ABSENT: 'danger',
};

const CHART_TOOLTIP_STYLE = {
  background: 'var(--dc-card)',
  border: '1px solid var(--dc-border)',
  borderRadius: 12,
  boxShadow: 'var(--dc-shadow-card)',
  color: 'var(--dc-ink)',
  fontSize: 12,
};

// Calendar color coding (GitHub-style heatmap).
const DAY_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: '#10B981', // emerald
  ABSENT: '#EF4444', // red
  HALF_DAY: '#F2A93B', // marigold
};

const WEEK_DAY_LABEL: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun',
};

/** Illustrated empty state — layered calendar shape, matches dashboard style. */
function AttendanceEmptyState({ monthLabel, year }: { monthLabel: string; year: number }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <div className="relative mb-6 h-28 w-28" aria-hidden="true">
        <div className="absolute inset-0 rotate-6 rounded-3xl bg-teal-100/80" />
        <div className="absolute inset-1.5 -rotate-3 rounded-2xl bg-white shadow-card" />
        <div className="absolute inset-0 flex items-center justify-center">
          <CalendarDays size={40} strokeWidth={1.6} className="text-teal-600" />
        </div>
        <span className="absolute -right-1 top-0 h-4 w-4 rounded-full bg-marigold-400 ring-2 ring-white" />
        <span className="absolute -left-1.5 bottom-2 h-3 w-3 rounded-full bg-teal-300" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink">No attendance yet</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
        Your employer hasn&apos;t marked attendance for {monthLabel} {year} yet. Once they
        start tracking, your days, streaks and charts will show up here.
      </p>
    </div>
  );
}

/** GitHub-style monthly calendar grid (Mon-first), color-coded by status. */
function AttendanceCalendar({ records, month, year }: { records: Attendance[]; month: number; year: number }) {
  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const r of records) map.set(r.date, r.status);
    return map;
  }, [records]);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month, 0).getDate();
    const total = offset + daysInMonth;
    const rows: (number | null)[][] = [];
    for (let i = 0; i < total; i += 7) {
      const row = Array.from({ length: 7 }, (_, c) => {
        const idx = i + c;
        if (idx < offset || idx >= total) return null;
        return idx - offset + 1;
      });
      rows.push(row);
    }
    return rows;
  }, [month, year]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-soft sm:gap-2">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <div key={d} className="py-0.5">
            {WEEK_DAY_LABEL[d]}
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5 sm:gap-2" role="grid" aria-label="Monthly attendance calendar">
        {cells.flat().map((day, i) => {
          if (day == null) return <div key={`pad-${i}`} aria-hidden="true" />;
          const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const status = byDate.get(iso);
          const isToday =
            day === new Date().getDate() &&
            month === new Date().getMonth() + 1 &&
            year === new Date().getFullYear();
          return (
            <div
              key={iso}
              role="gridcell"
              data-testid="calendar-day"
              data-status={status ?? 'none'}
              aria-label={status ? `${iso} — ${STATUS_LABEL[status]}` : iso}
              title={status ? `${formatDate(iso)} — ${STATUS_LABEL[status]}` : formatDate(iso)}
              className={[
                'relative flex aspect-square items-center justify-center rounded-lg text-xs font-semibold transition-transform',
                status ? 'text-white' : 'bg-line/60 text-ink-soft/70',
                isToday ? 'ring-2 ring-teal-500 ring-offset-1 ring-offset-white dark:ring-offset-card' : '',
                'hover:scale-110',
              ].join(' ')}
              style={status ? { backgroundColor: DAY_COLOR[status] } : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11px] font-medium text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" aria-hidden="true" /> Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-marigold-500" aria-hidden="true" /> Half day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-line" aria-hidden="true" /> Holiday / not marked
        </span>
      </div>
    </div>
  );
}

/** Weekly attendance (Mon-Sun buckets of the selected month), stacked bars. */
function WeeklyAttendanceChart({ records, month, year }: { records: Attendance[]; month: number; year: number }) {
  const data = useMemo(() => {
    const buckets = new Map<number, { present: number; absent: number; halfDay: number }>();
    const weekOf = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      return Math.floor(((d.getDate() - 1) + ((d.getDay() + 6) % 7)) / 7);
    };
    for (const r of records) {
      const w = weekOf(r.date);
      const b = buckets.get(w) ?? { present: 0, absent: 0, halfDay: 0 };
      if (r.status === 'PRESENT') b.present += 1;
      else if (r.status === 'ABSENT') b.absent += 1;
      else b.halfDay += 1;
      buckets.set(w, b);
    }
    const first = new Date(year, month - 1, 1);
    const weeks = Math.ceil((new Date(year, month, 0).getDate() + ((first.getDay() + 6) % 7)) / 7);
    return Array.from({ length: weeks }, (_, i) => {
      const b = buckets.get(i) ?? { present: 0, absent: 0, halfDay: 0 };
      const start = i * 7 + 1;
      return {
        week: `Wk ${i + 1}`,
        start,
        end: Math.min(start + 6, new Date(year, month, 0).getDate()),
        present: b.present,
        absent: b.absent,
        halfDay: b.halfDay,
      };
    });
  }, [records, month, year]);

  return (
    <div className="h-52" aria-label="Weekly attendance breakdown">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--dc-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--dc-border)' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--dc-teal-100)' }}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value, name) => {
              const label =
                name === 'present' ? 'Present' : name === 'absent' ? 'Absent' : 'Half day';
              return [value, label];
            }}
          />
          <Bar dataKey="present" name="present" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="halfDay" name="halfDay" fill="#F2A93B" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="absent" name="absent" fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Attendance trend — percentage present per week across the month. */
function AttendanceTrendChart({ records, month, year }: { records: Attendance[]; month: number; year: number }) {
  const data = useMemo(() => {
    const weekOf = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      return Math.floor(((d.getDate() - 1) + ((d.getDay() + 6) % 7)) / 7);
    };
    const buckets = new Map<number, { present: number; halfDay: number; marked: number }>();
    for (const r of records) {
      const w = weekOf(r.date);
      const b = buckets.get(w) ?? { present: 0, halfDay: 0, marked: 0 };
      b.marked += 1;
      if (r.status === 'PRESENT') b.present += 1;
      else if (r.status === 'HALF_DAY') b.halfDay += 0.5;
      buckets.set(w, b);
    }
    const first = new Date(year, month - 1, 1);
    const weeks = Math.ceil((new Date(year, month, 0).getDate() + ((first.getDay() + 6) % 7)) / 7);
    return Array.from({ length: weeks }, (_, i) => {
      const b = buckets.get(i);
      const rate = b && b.marked > 0 ? Math.round(((b.present + b.halfDay) / b.marked) * 100) : null;
      return { week: `Wk ${i + 1}`, rate };
    });
  }, [records, month, year]);

  const hasData = data.some((d) => d.rate != null);

  if (!hasData) {
    return (
      <div className="flex h-52 flex-col items-center justify-center text-center">
        <TrendingUp size={28} strokeWidth={1.6} className="text-ink-soft/50" aria-hidden="true" />
        <p className="mt-2 text-sm text-ink-soft">Trend appears once attendance is marked.</p>
      </div>
    );
  }

  return (
    <div className="h-52" aria-label="Attendance trend across the month">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="attTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--dc-teal-500)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--dc-teal-500)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--dc-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--dc-border)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--dc-ink-mute)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            cursor={{ stroke: 'var(--dc-teal-500)', strokeDasharray: '3 3' }}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [`${value ?? '—'}%`, 'Attendance']}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--dc-teal-600)"
            strokeWidth={2.5}
            fill="url(#attTrendGradient)"
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Streak helpers. */
function currentStreak(records: Attendance[]): number {
  if (records.length === 0) return 0;
  const byDate = new Map(records.map((r) => [r.date, r.status]));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  let cursor = new Date();
  // If today is not yet marked, start the walk from the most recent mark.
  if (!byDate.has(iso(cursor))) {
    const latest = records
      .map((r) => r.date)
      .sort()
      .reverse()[0];
    if (!latest || latest > iso(cursor)) return 0;
    cursor = new Date(`${latest}T00:00:00`);
  }
  let streak = 0;
  let walking = true;
  while (walking) {
    const status = byDate.get(iso(cursor));
    if (status === 'PRESENT' || status === 'HALF_DAY') {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      walking = false;
    }
  }
  return streak;
}

/**
 * MyAttendance — the worker's attendance tracking page. Monthly summary cards,
 * a GitHub-style color-coded calendar, weekly + trend charts, export (CSV/PDF)
 * and an illustrated empty state (GET /api/attendance/worker/{id}?month=&year=).
 */
export default function MyAttendance() {
  const { currentUser } = useAuth();
  const workerId = currentUser?.id;

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear());
  const [report, setReport] = useState<WorkerAttendanceReport | null>(null);
  const [loading, setLoading] = useState(Boolean(workerId));
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { toasts, pushToast, dismissToast } = useToast();

  useEffect(() => {
    if (!workerId) {
      setReport(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await attendanceApi.getWorkerAttendance(
          workerId,
          month,
          year,
          { signal: controller.signal }
        );
        setReport(data);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load your attendance.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [workerId, month, year, refresh]);

  const summary = report?.summary;
  const records = useMemo(() => report?.records ?? [], [report]);

  const rate =
    summary && summary.totalDays > 0
      ? Math.round((summary.presentDays / summary.totalDays) * 100)
      : null;
  const streak = useMemo(() => currentStreak(records), [records]);
  const monthLabel = MONTHS[month - 1]?.label ?? '';

  const exportCSV = () => {
    if (!report || records.length === 0) {
      pushToast('Nothing to export yet — attendance hasn’t been marked.', 'error');
      return;
    }
    const header = 'Date,Status,Marked at';
    const rows = records.map((r) =>
      [r.date, STATUS_LABEL[r.status] ?? r.status, r.createdAt]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${monthLabel.toLowerCase()}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Attendance exported as CSV.');
  };

  const exportPDF = () => {
    if (!report || records.length === 0) {
      pushToast('Nothing to export yet — attendance hasn’t been marked.', 'error');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      pushToast('Popup blocked — allow popups to export as PDF.', 'error');
      return;
    }
    const rowHtml = records
      .map(
        (r) => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${formatDate(r.date)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb"><strong>${STATUS_LABEL[r.status] ?? r.status}</strong></td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${new Date(r.createdAt).toLocaleString('en-IN')}</td>
        </tr>`
      )
      .join('');
    printWindow.document.write(`<!doctype html><html><head><title>Attendance — ${monthLabel} ${year}</title>
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
        <h1>Attendance Report — ${monthLabel} ${year}</h1>
        <p class="sub">${currentUser?.name ?? 'Worker'} · Generated ${new Date().toLocaleDateString('en-IN')}</p>
        <div class="cards">
          <div class="card"><div class="n">${summary?.presentDays ?? 0}</div><div class="l">Present</div></div>
          <div class="card"><div class="n">${summary?.absentDays ?? 0}</div><div class="l">Absent</div></div>
          <div class="card"><div class="n">${summary?.halfDays ?? 0}</div><div class="l">Half days</div></div>
          <div class="card"><div class="n">${rate != null ? `${rate}%` : '—'}</div><div class="l">Attendance</div></div>
        </div>
        <table><thead><tr><th>Date</th><th>Status</th><th>Marked at</th></tr></thead><tbody>${rowHtml}</tbody></table>
        <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
      </body></html>`);
    printWindow.document.close();
    pushToast('Opening print dialog — choose “Save as PDF”.');
  };

  return (
    <section aria-busy={loading}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header + export actions */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold text-ink">My attendance</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {monthLabel} {year} · As recorded by your employer
          </p>
        </div>
        {!loading && !error && records.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <Download size={15} aria-hidden="true" />
              CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportPDF}>
              <FileText size={15} aria-hidden="true" />
              PDF
            </Button>
          </div>
        )}
      </div>

      {/* Month/year filters */}
      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-md">
          <Select
            id="attendance-month"
            label="Month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Select
            id="attendance-year"
            label="Year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </Card>

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
      ) : loading ? (
        <div data-testid="attendance-loading" className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-52 w-full rounded-2xl" />
          </div>
        </div>
      ) : error ? (
        <Card className="border-danger/30 bg-danger-soft/40">
          <h4 className="font-display text-base font-semibold text-ink">
            Couldn&apos;t load your attendance
          </h4>
          <p className="mt-1 text-sm text-ink-soft">{error}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setRefresh((r) => r + 1)}
          >
            Try again
          </Button>
        </Card>
      ) : records.length === 0 ? (
        <Card>
          <AttendanceEmptyState monthLabel={monthLabel} year={year} />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 inline-flex rounded-xl bg-success-soft p-2 text-success-text" aria-hidden="true">
                <CheckCircle2 size={18} />
              </div>
              <div className="font-display text-3xl font-bold text-ink">{summary?.presentDays ?? 0}</div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Days present
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {summary?.halfDays ?? 0} half day{summary?.halfDays === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 inline-flex rounded-xl bg-danger-soft p-2 text-danger-text" aria-hidden="true">
                <XCircle size={18} />
              </div>
              <div className="font-display text-3xl font-bold text-ink">{summary?.absentDays ?? 0}</div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Days absent
              </div>
              <p className="mt-1 text-xs text-ink-soft">of {summary?.totalDays ?? 0} marked days</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 inline-flex rounded-xl bg-marigold-100 p-2 text-marigold-600" aria-hidden="true">
                <BarChart3 size={18} />
              </div>
              <div className="font-display text-3xl font-bold text-ink">
                {rate != null ? `${rate}%` : '—'}
              </div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Attendance rate
              </div>
              <p className="mt-1 text-xs text-ink-soft">present days ÷ marked days</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 inline-flex rounded-xl bg-teal-100 p-2 text-teal-700" aria-hidden="true">
                <Flame size={18} />
              </div>
              <div className="font-display text-3xl font-bold text-ink">{streak}</div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Current streak
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {streak === 1 ? 'day in a row' : 'days in a row'}
              </p>
            </div>
          </div>

          {/* Calendar + weekly chart */}
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <CalendarCheck size={16} className="text-teal-700" aria-hidden="true" />
                    Attendance calendar
                  </span>
                }
                subtitle={`${monthLabel} ${year} — colour-coded by day`}
              />
              <AttendanceCalendar records={records} month={month} year={year} />
            </Card>
            <Card className="lg:col-span-5">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-teal-700" aria-hidden="true" />
                    Weekly breakdown
                  </span>
                }
                subtitle="Present · half day · absent per week"
              />
              <WeeklyAttendanceChart records={records} month={month} year={year} />
            </Card>
          </div>

          {/* Trend chart */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-teal-700" aria-hidden="true" />
                  Attendance trend
                </span>
              }
              subtitle="Weekly attendance rate across the month"
            />
            <AttendanceTrendChart records={records} month={month} year={year} />
          </Card>

          {/* Records table */}
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-line bg-canvas/60 px-5 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Daily records
              </h4>
              <span className="text-xs text-ink-soft">{records.length} day{records.length === 1 ? '' : 's'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Date
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Marked at
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-line last:border-b-0 hover:bg-canvas/50">
                      <td className="px-5 py-3 font-medium text-ink">{formatDate(record.date)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_BADGE[record.status] ?? 'neutral'}>
                          {STATUS_LABEL[record.status] ?? record.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {new Date(record.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
