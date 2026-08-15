import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarkAttendance from './MarkAttendance';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const CURRENT_USER = { id: 5, name: 'Mark', role: 'EMPLOYER' };

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

const JOBS = [
  {
    id: 1,
    title: 'Household Helper',
    description: 'Daily cleaning and cooking for a family.',
    employerId: 5,
    wagePerDay: 500,
    location: 'Bengaluru, Karnataka',
    status: 'OPEN',
  },
  {
    id: 3,
    title: 'Cook',
    description: 'Evening meal preparation.',
    employerId: 5,
    wagePerDay: 600,
    location: 'Pune, Maharashtra',
    status: 'ASSIGNED',
    workerId: 11,
  },
  {
    id: 2,
    title: 'Gardener',
    description: 'Weekly gardening.',
    employerId: 7,
    wagePerDay: 400,
    location: 'Mysuru, Karnataka',
    status: 'OPEN',
  },
  {
    id: 4,
    title: 'Old Job',
    description: 'Closed posting.',
    employerId: 5,
    wagePerDay: 300,
    location: 'Delhi',
    status: 'CLOSED',
  },
];

// Mirrors the page's todayISO() helper so expected payloads match exactly.
const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const reportUrlFor = (workerId) => {
  const now = new Date();
  return `/api/attendance/worker/${workerId}?month=${now.getMonth() + 1}&year=${now.getFullYear()}`;
};

const renderMarkAttendance = () => render(<MarkAttendance />);

const selectWorker = async (user, workerId) => {
  await screen.findByLabelText('Worker');
  await user.selectOptions(screen.getByLabelText('Worker'), String(workerId));
};

describe('MarkAttendance', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ currentUser: CURRENT_USER });
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
    // Per-URL mock: workers (auth envelope), report (AttendanceReport),
    // and the employer's job list.
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url.startsWith('/api/attendance/worker/')) {
        return Promise.resolve({ data: REPORT });
      }
      return Promise.resolve({ data: JOBS });
    });
  });

  it('keeps the Mark button disabled until a worker is chosen', async () => {
    const user = userEvent.setup();
    renderMarkAttendance();

    expect(screen.getByRole('button', { name: /mark attendance/i })).toBeDisabled();

    await selectWorker(user, 11);
    expect(screen.getByRole('button', { name: /mark attendance/i })).toBeEnabled();
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
      return Promise.resolve({ data: JOBS });
    });
    const user = userEvent.setup();
    renderMarkAttendance();

    await selectWorker(user, 11);

    // Report fetch is pending → spinner, then the table.
    expect(screen.getByTestId('report-loading')).toBeInTheDocument();

    await act(async () => {
      resolveReport({ data: REPORT });
    });

    expect(screen.queryByTestId('report-loading')).not.toBeInTheDocument();

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

  it('loads only the employer’s ASSIGNED jobs into the picker', async () => {
    const user = userEvent.setup();
    renderMarkAttendance();

    await selectWorker(user, 11);
    await user.click(screen.getByRole('button', { name: /mark attendance/i }));

    const modal = await screen.findByRole('dialog');
    // The modal names the selected worker.
    expect(modal).toHaveTextContent('Ana');

    // Wait for the jobs fetch to resolve before reading the options.
    await within(modal).findByRole('option', { name: /cook/i });

    const jobOptions = within(modal).getAllByRole('option');
    const labels = jobOptions.map((option) => option.textContent);
    expect(labels.join(' | ')).toContain('Cook'); // ASSIGNED, mine
    // OPEN jobs, another employer's jobs and CLOSED jobs are all excluded.
    expect(within(modal).queryByRole('option', { name: /household helper/i })).not.toBeInTheDocument();
    expect(within(modal).queryByRole('option', { name: /gardener/i })).not.toBeInTheDocument();
    expect(within(modal).queryByRole('option', { name: /old job/i })).not.toBeInTheDocument();
  });

  it('lists only workers assigned to the employer’s job posts', async () => {
    renderMarkAttendance();

    // Ana (11) is the assignee of the employer's ASSIGNED Cook job; Ben (12)
    // has no assignment and must not appear in the picker.
    const workerSelect = await screen.findByLabelText('Worker');
    const labels = within(workerSelect)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(labels.join(' | ')).toContain('Select a worker…');
    expect(labels.join(' | ')).toContain('Ana (ana@example.com)');
    expect(labels.join(' | ')).not.toContain('Ben');
  });

  it('shows a hint when the employer has no assigned workers yet', async () => {
    // The employer's only posting is still OPEN — nobody to mark attendance
    // for yet.
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url.startsWith('/api/attendance/worker/')) {
        return Promise.resolve({ data: REPORT });
      }
      return Promise.resolve({ data: [JOBS[0]] }); // Household Helper, status OPEN
    });
    renderMarkAttendance();

    expect(await screen.findByText(/no assigned workers yet/i)).toBeInTheDocument();
    // Without an assigned worker there is nothing to mark.
    expect(screen.getByRole('button', { name: /mark attendance/i })).toBeDisabled();
  });

  it('requires a job before marking (client-side validation)', async () => {
    const user = userEvent.setup();
    renderMarkAttendance();

    await selectWorker(user, 11);
    await user.click(screen.getByRole('button', { name: /mark attendance/i }));

    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /save attendance/i }));

    expect(await within(modal).findByText('Select a job.')).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('posts the attendance payload, shows a toast, closes the modal and refreshes the report', async () => {
    const user = userEvent.setup();
    axiosInstance.post.mockResolvedValue({ data: { success: true } });
    renderMarkAttendance();

    await selectWorker(user, 11);
    await user.click(screen.getByRole('button', { name: /mark attendance/i }));

    const modal = await screen.findByRole('dialog');
    // Only ASSIGNED jobs appear; the fixture's Cook (id 3) is the assigned one.
    await user.selectOptions(await within(modal).findByLabelText('Job'), '3');
    await user.click(within(modal).getByRole('button', { name: /save attendance/i }));

    expect(axiosInstance.post).toHaveBeenCalledWith('/api/attendance/mark', {
      workerId: 11,
      jobId: 3,
      date: todayISO(),
      status: 'PRESENT',
    });

    expect(await screen.findByText(new RegExp(`Attendance marked for Ana on ${todayISO()}`)))
      .toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The success refreshed the report for the same worker/month/year.
    const reportCalls = axiosInstance.get.mock.calls.filter(([url]) =>
      url.includes('/api/attendance/worker/11')
    );
    expect(reportCalls.length).toBeGreaterThanOrEqual(2);
    expect(reportCalls[0][0]).toBe(reportUrlFor(11));
  });

  it('keeps the modal open and shows an error toast when marking fails', async () => {
    const user = userEvent.setup();
    axiosInstance.post.mockRejectedValue({
      response: { data: { message: 'Attendance already marked for this day' } },
    });
    renderMarkAttendance();

    await selectWorker(user, 11);
    await user.click(screen.getByRole('button', { name: /mark attendance/i }));

    const modal = await screen.findByRole('dialog');
    await user.selectOptions(await within(modal).findByLabelText('Job'), '3');
    await user.click(within(modal).getByRole('button', { name: /save attendance/i }));

    expect(
      await screen.findByText('Attendance already marked for this day')
    ).toBeInTheDocument();
    // The modal stays open so the employer can adjust and retry.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
      return Promise.resolve({ data: JOBS });
    });
    const user = userEvent.setup();
    renderMarkAttendance();

    await selectWorker(user, 11);

    expect(
      await screen.findByRole('heading', { name: /couldn't load the report/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Report service unavailable')).toBeInTheDocument();

    // Retry recovers and renders the report table.
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('row', { name: /present/i })).toBeInTheDocument();
  });

  it('cancels the modal without posting', async () => {
    const user = userEvent.setup();
    renderMarkAttendance();

    await selectWorker(user, 11);
    await user.click(screen.getByRole('button', { name: /mark attendance/i }));

    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /cancel/i }));

    expect(axiosInstance.post).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
