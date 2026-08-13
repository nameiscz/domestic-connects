import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminAttendance from './AdminAttendance';

// Mock the axios instance so tests control every fetch directly.
// (AdminAttendance reads no auth context — only the worker/report APIs.)
const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const WORKERS = [
  {
    id: 11,
    name: 'Ana',
    email: 'ana@example.com',
    role: 'WORKER',
    active: true,
  },
  {
    id: 12,
    name: 'Ben',
    email: 'ben@example.com',
    role: 'WORKER',
    active: true,
  },
];

const REPORT = {
  workerId: 11,
  records: [
    {
      id: 101,
      date: '2026-08-01',
      status: 'PRESENT',
      createdAt: '2026-08-01T18:00:00Z',
    },
    {
      id: 102,
      date: '2026-08-02',
      status: 'HALF_DAY',
      createdAt: '2026-08-02T18:00:00Z',
    },
  ],
  summary: { presentDays: 1, halfDays: 1, absentDays: 0, totalDays: 2 },
};

const reportUrlFor = (workerId) => {
  const now = new Date();
  return `/api/attendance/worker/${workerId}?month=${now.getMonth() + 1}&year=${now.getFullYear()}`;
};

const reportCalls = () =>
  axiosInstance.get.mock.calls.filter(([url]) => url.includes('/api/attendance/worker/'));

const selectWorker = async (user, workerId) => {
  await user.selectOptions(await screen.findByLabelText('Worker'), String(workerId));
};

const renderPage = () => render(<AdminAttendance />);

describe('AdminAttendance', () => {
  beforeEach(() => {
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
    // Per-URL mock: worker pool (auth envelope), report (AttendanceReport).
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url.startsWith('/api/attendance/worker/')) {
        return Promise.resolve({ data: REPORT });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('prompts for a worker before any is chosen and does not fetch a report', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /select a worker/i })
    ).toBeInTheDocument();
    expect(reportCalls()).toHaveLength(0);
  });

  it('loads the worker pool into the picker and fetches the chosen worker’s report for the current month/year', async () => {
    const user = userEvent.setup();
    renderPage();

    await selectWorker(user, 11);

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith(reportUrlFor(11), expect.anything());
    });
  });

  it('shows a spinner while the report loads, then renders records and summary', async () => {
    let resolveReport;
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url.startsWith('/api/attendance/worker/')) {
        return new Promise((resolve) => {
          resolveReport = resolve;
        });
      }
      return Promise.resolve({ data: [] });
    });
    const user = userEvent.setup();
    renderPage();

    await selectWorker(user, 11);

    // Report fetch is pending → spinner, then the table.
    expect(screen.getByTestId('admin-attendance-loading')).toBeInTheDocument();

    await act(async () => {
      resolveReport({ data: REPORT });
    });

    expect(screen.queryByTestId('admin-attendance-loading')).not.toBeInTheDocument();

    // Summary cards render the monthly totals ("Present" appears in the
    // summary stat AND the record badge → exactly 2 occurrences).
    expect(screen.getAllByText('Present')).toHaveLength(2);
    expect(screen.getByText('Half days')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();

    // Records table: header + one row per record, with status badges.
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('Present');
    expect(rows[2]).toHaveTextContent('Half day');
  });

  it('refetches the report when the selected month changes', async () => {
    const user = userEvent.setup();
    renderPage();

    await selectWorker(user, 11);
    await screen.findByText('Half day');
    await user.selectOptions(screen.getByLabelText('Month'), '12');

    await waitFor(() => {
      const last = reportCalls().at(-1)[0];
      expect(last).toContain('month=12');
    });
  });

  it('shows an empty state when the worker has no attendance records', async () => {
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url.startsWith('/api/attendance/worker/')) {
        return Promise.resolve({
          data: {
            workerId: 11,
            records: [],
            summary: { presentDays: 0, halfDays: 0, absentDays: 0, totalDays: 0 },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    const user = userEvent.setup();
    renderPage();

    await selectWorker(user, 11);

    expect(await screen.findByText('No attendance yet')).toBeInTheDocument();
    expect(screen.getByText(/no records for .* for Ana yet/i)).toBeInTheDocument();
  });

  it('shows an error with retry when the report fails to load', async () => {
    let reportCallCount = 0;
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url.startsWith('/api/attendance/worker/')) {
        reportCallCount += 1;
        if (reportCallCount === 1) {
          return Promise.reject({
            response: { data: { message: 'Report service unavailable' } },
          });
        }
        return Promise.resolve({ data: REPORT });
      }
      return Promise.resolve({ data: [] });
    });
    const user = userEvent.setup();
    renderPage();

    await selectWorker(user, 11);

    expect(
      await screen.findByRole('heading', { name: /couldn't load the report/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Report service unavailable')).toBeInTheDocument();

    // Retry recovers and renders the report table.
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Half day')).toBeInTheDocument();
  });

  it('shows an error with retry when the worker pool fails to load', async () => {
    let workerCallCount = 0;
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        workerCallCount += 1;
        if (workerCallCount === 1) {
          return Promise.reject({
            response: { data: { message: 'Auth service unavailable' } },
          });
        }
        return Promise.resolve({ data: { data: WORKERS } });
      }
      return Promise.resolve({ data: [] });
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Auth service unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByLabelText('Worker');
    expect(screen.getByRole('option', { name: /ana \(ana@example\.com\)/i })).toBeInTheDocument();
  });

  it('explains when no active workers are available', async () => {
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: [] });
    });
    renderPage();

    expect(
      await screen.findByText(/no active workers are available yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /ana/i })).not.toBeInTheDocument();
  });
});
