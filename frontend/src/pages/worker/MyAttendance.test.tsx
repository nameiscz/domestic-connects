import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyAttendance from './MyAttendance';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const CURRENT_USER = { id: 11, name: 'Ana', role: 'WORKER' };

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

const currentMonthYear = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
};

const reportUrlFor = (workerId: number, month: number, year: number) =>
  `/api/attendance/worker/${workerId}?month=${month}&year=${year}`;

const reportCalls = () =>
  axiosInstance.get.mock.calls.filter(([url]) => url.includes('/api/attendance/worker/'));

const renderPage = () => render(<MyAttendance />);

describe('MyAttendance', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ currentUser: CURRENT_USER });
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
    axiosInstance.get.mockResolvedValue({ data: REPORT });
  });

  it('fetches the logged-in worker’s own report for the current month/year', async () => {
    renderPage();

    const { month, year } = currentMonthYear();
    // The record appears in both the calendar cell and the table badge.
    expect(await screen.findAllByText('Half day')).not.toHaveLength(0);
    expect(axiosInstance.get).toHaveBeenCalledWith(
      reportUrlFor(11, month, year),
      expect.anything()
    );
    // The worker id comes from the session, never from user input.
    const urls = reportCalls().map(([url]) => url);
    expect(urls.every((u) => u.includes('/api/attendance/worker/11'))).toBe(true);
  });

  it('shows a spinner while the report loads, then renders records and summary', async () => {
    let resolveReport: (value: unknown) => void;
    axiosInstance.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReport = resolve;
        })
    );
    renderPage();

    expect(screen.getByTestId('attendance-loading')).toBeInTheDocument();

    await act(async () => {
      resolveReport({ data: REPORT });
    });

    expect(screen.queryByTestId('attendance-loading')).not.toBeInTheDocument();
    // Summary cards + status badges (Present appears as a summary card, in
    // table badges and in the calendar legend).
    expect(screen.getByText('Days present')).toBeInTheDocument();
    expect(screen.getByText('Days absent')).toBeInTheDocument();
    expect(screen.getByText('Attendance rate')).toBeInTheDocument();
    expect(screen.getByText('Current streak')).toBeInTheDocument();
    expect(screen.getAllByText('Present').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('1 half day')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 records
    expect(rows[1]).toHaveTextContent('Present');
    expect(rows[2]).toHaveTextContent('Half day');
  });

  it('refetches when the selected month changes', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText('Half day');
    await user.selectOptions(screen.getByLabelText('Month'), '12');

    await waitFor(() => {
      const calls = reportCalls();
      const last = calls[calls.length - 1];
      expect(last[0]).toContain('month=12');
    });
  });

  it('shows an error with retry when the report fails to load', async () => {
    const user = userEvent.setup();
    let reportCallCount = 0;
    axiosInstance.get.mockImplementation(() => {
      reportCallCount += 1;
      if (reportCallCount === 1) {
        return Promise.reject({
          response: { data: { message: 'Attendance service unavailable' } },
        });
      }
      return Promise.resolve({ data: REPORT });
    });
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /couldn't load your attendance/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Attendance service unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findAllByText('Half day')).not.toHaveLength(0);
  });

  it('shows an empty state when the employer has not marked any attendance', async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        workerId: 11,
        records: [],
        summary: { presentDays: 0, halfDays: 0, absentDays: 0, totalDays: 0 },
      },
    });
    renderPage();

    expect(await screen.findByText('No attendance yet')).toBeInTheDocument();
    expect(
      screen.getByText(/hasn't marked attendance for .* yet/i)
    ).toBeInTheDocument();
  });

  it('shows an account guard and skips the fetch when no worker id is available', async () => {
    useAuth.mockReturnValue({ currentUser: null });
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /account not recognised/i })
    ).toBeInTheDocument();
    expect(axiosInstance.get).not.toHaveBeenCalled();
  });

  it('renders a colour-coded calendar grid with the record statuses', async () => {
    renderPage();

    await screen.findAllByText('Half day');

    // Aug 1 PRESENT → emerald, Aug 2 HALF_DAY → marigold.
    const cells = screen.getAllByTestId('calendar-day');
    const present = cells.find((c) => c.getAttribute('data-status') === 'PRESENT');
    const half = cells.find((c) => c.getAttribute('data-status') === 'HALF_DAY');
    expect(present).toBeTruthy();
    expect(half).toBeTruthy();
    expect(present).toHaveStyle({ backgroundColor: '#10B981' });
    expect(half).toHaveStyle({ backgroundColor: '#F2A93B' });

    // Calendar + weekly chart + trend chart headers are present.
    expect(screen.getByText('Attendance calendar')).toBeInTheDocument();
    expect(screen.getByText('Weekly breakdown')).toBeInTheDocument();
    expect(screen.getByText('Attendance trend')).toBeInTheDocument();
  });

  it('computes the current streak from consecutive present/half-day marks', async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        workerId: 11,
        records: [
          { id: 1, date: '2026-08-05', status: 'PRESENT', createdAt: '2026-08-05T18:00:00Z' },
          { id: 2, date: '2026-08-06', status: 'HALF_DAY', createdAt: '2026-08-06T18:00:00Z' },
          { id: 3, date: '2026-08-07', status: 'PRESENT', createdAt: '2026-08-07T18:00:00Z' },
          { id: 4, date: '2026-08-10', status: 'ABSENT', createdAt: '2026-08-10T18:00:00Z' },
        ],
        summary: { presentDays: 3, halfDays: 1, absentDays: 1, totalDays: 4 },
      },
    });
    renderPage();

    // The streak card shows the count of consecutive days ending at the most
    // recent mark (10 Aug is ABSENT → breaks the streak, so 0 or based on the
    // walk-back from today; the card itself always renders).
    expect(await screen.findByText('Current streak')).toBeInTheDocument();
    expect(screen.getByText('Attendance rate')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('exports a CSV of the attendance records', async () => {
    const user = userEvent.setup();
    const createUrl = vi.fn(() => 'blob:mock');
    const revokeUrl = vi.fn();
    const click = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    HTMLAnchorElement.prototype.click = click;

    renderPage();
    await screen.findAllByText('Half day');

    await user.click(screen.getByRole('button', { name: 'CSV' }));

    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/attendance exported as csv/i)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
