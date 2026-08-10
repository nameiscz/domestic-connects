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

const reportUrlFor = (workerId, month, year) =>
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
    expect(await screen.findByText('Half day')).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith(
      reportUrlFor(11, month, year),
      expect.anything()
    );
    // The worker id comes from the session, never from user input.
    const urls = reportCalls().map(([url]) => url);
    expect(urls.every((u) => u.includes('/api/attendance/worker/11'))).toBe(true);
  });

  it('shows a spinner while the report loads, then renders records and summary', async () => {
    let resolveReport;
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
    // Summary cards + status badges.
    expect(screen.getAllByText('Present')).toHaveLength(2); // summary + badge
    expect(screen.getByText('Half days')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 records
    expect(rows[1]).toHaveTextContent('Present');
    expect(rows[2]).toHaveTextContent('Half day');
  });

  it('refetches when the selected month changes', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Half day');
    await user.selectOptions(screen.getByLabelText('Month'), '12');

    await waitFor(() => {
      const last = reportCalls().at(-1)[0];
      expect(last).toContain('month=12');
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
    expect(await screen.findByText('Half day')).toBeInTheDocument();
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
});
