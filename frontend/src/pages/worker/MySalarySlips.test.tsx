import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MySalarySlips from './MySalarySlips';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

// jsdom has no URL.createObjectURL — stub it and capture the anchor used for
// the download so the filename can be asserted.
const { createObjectURLMock, revokeObjectURLMock } = vi.hoisted(() => ({
  createObjectURLMock: vi.fn(() => 'blob:salary-slip'),
  revokeObjectURLMock: vi.fn(),
}));

const CURRENT_USER = { id: 11, name: 'Ana', role: 'WORKER' };

const currentPeriod = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const pdfBlob = () => new Blob(['%PDF-1.4\n% salary slip'], { type: 'application/pdf' });
const csvBlob = () => new Blob(['month,year,gross\n7,2026,12500'], { type: 'text/csv' });

const slipResponse = (overrides: Record<string, unknown> = {}) => ({
  data: pdfBlob(),
  headers: { 'content-disposition': 'attachment; filename="salary-slip-11-8-2026.pdf"' },
  ...overrides,
});

const csvResponse = (overrides: Record<string, unknown> = {}) => ({
  data: csvBlob(),
  headers: { 'content-disposition': 'attachment; filename="salary-history-11-8-2026.csv"' },
  ...overrides,
});

const HISTORY = [
  {
    id: 201,
    workerId: 11,
    workerName: 'Ana',
    month: 7,
    year: 2026,
    presentDays: 24,
    halfDays: 2,
    wagePerDay: 500,
    grossSalary: 12500,
    generatedAt: '2026-08-01T10:00:00',
  },
  {
    id: 202,
    workerId: 11,
    workerName: 'Ana',
    month: 8,
    year: 2026,
    presentDays: 20,
    halfDays: 0,
    wagePerDay: 500,
    grossSalary: 10000,
    generatedAt: '2026-09-01T10:00:00',
  },
];

const isExportUrl = (url: string) => url.includes('/api/payroll/11/history/export');
const isHistoryUrl = (url: string) =>
  url.includes('/api/payroll/11/history') && !url.includes('/export');

const historyCalls = () =>
  axiosInstance.get.mock.calls.filter(([url]) => isHistoryUrl(url));

const renderPage = () =>
  render(
    <MemoryRouter>
      <MySalarySlips />
    </MemoryRouter>
  );

describe('MySalarySlips', () => {
  // The anchor element the component clicks to start the download.
  let capturedAnchor: HTMLAnchorElement | null;

  beforeEach(() => {
    useAuth.mockReturnValue({ currentUser: CURRENT_USER });
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
    // Route by URL: the history request runs on mount, the slip request on
    // button click, and each test may override the slip behaviour below.
    axiosInstance.get.mockImplementation((url: string) => {
      if (isExportUrl(url)) return Promise.resolve(csvResponse());
      if (isHistoryUrl(url)) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve(slipResponse());
    });

    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    capturedAnchor = null;
    // triggerDownload appends the anchor before clicking it, so grab it from
    // the DOM at click time (avoids aliasing `this` to a local).
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      capturedAnchor = document.querySelector<HTMLAnchorElement>('a[download]');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the slip for the logged-in worker as a blob for the default month/year', async () => {
    const user = userEvent.setup();
    renderPage();

    const { month, year } = currentPeriod();
    await user.click(screen.getByTestId('download-salary-slip'));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith(
        '/api/payroll/11/slip',
        expect.objectContaining({
          params: { month, year, workerName: 'Ana' },
          responseType: 'blob',
        })
      );
    });

    // The PDF blob was wrapped in an object URL and handed to a temp <a>.
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.href).toBe('blob:salary-slip');
    expect(capturedAnchor!.download).toBe('salary-slip-11-8-2026.pdf');

    expect(
      await screen.findByText(/salary slip for .* downloaded/i)
    ).toBeInTheDocument();
  });

  it('downloads the slip for the selected month/year', async () => {
    const user = userEvent.setup();
    renderPage();

    const { year } = currentPeriod();
    await user.selectOptions(screen.getByLabelText('Month'), '12');
    await user.selectOptions(screen.getByLabelText('Year'), String(year + 1));
    await user.click(screen.getByTestId('download-salary-slip'));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith(
        '/api/payroll/11/slip',
        expect.objectContaining({
          params: expect.objectContaining({ month: 12, year: year + 1 }),
        })
      );
    });
  });

  it('falls back to salary-slip-{month}-{year}.pdf when no Content-Disposition is sent', async () => {
    axiosInstance.get.mockImplementation((url: string) =>
      isHistoryUrl(url)
        ? Promise.resolve({ data: { data: [] } })
        : Promise.resolve({ data: pdfBlob(), headers: {} })
    );
    const user = userEvent.setup();
    renderPage();

    const { month, year } = currentPeriod();
    await user.click(screen.getByTestId('download-salary-slip'));

    await waitFor(() => expect(capturedAnchor).not.toBeNull());
    expect(capturedAnchor!.download).toBe(`salary-slip-${month}-${year}.pdf`);
  });

  it('shows a loading state while the PDF is being generated, then confirms', async () => {
    let resolveDownload: (value: unknown) => void;
    axiosInstance.get.mockImplementation((url: string) =>
      isHistoryUrl(url)
        ? Promise.resolve({ data: { data: [] } })
        : new Promise((resolve) => {
            resolveDownload = resolve;
          })
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('download-salary-slip'));

    expect(screen.getByTestId('salary-slip-downloading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled();

    await act(async () => {
      resolveDownload(slipResponse());
    });

    expect(screen.queryByTestId('salary-slip-downloading')).not.toBeInTheDocument();
    expect(screen.getByTestId('salary-slip-success')).toBeInTheDocument();
  });

  it('surfaces the backend message when the slip cannot be generated (blob error body)', async () => {
    axiosInstance.get.mockImplementation((url: string) =>
      isHistoryUrl(url)
        ? Promise.resolve({ data: { data: [] } })
        : Promise.reject({
            response: {
              status: 404,
              data: new Blob(
                [JSON.stringify({ message: 'No attendance records found for this month' })],
                { type: 'application/json' }
              ),
            },
          })
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('download-salary-slip'));

    expect(
      await screen.findByRole('heading', { name: /couldn't generate the slip/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText('No attendance records found for this month')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('falls back to a generic message on network errors and retries successfully', async () => {
    const user = userEvent.setup();
    let slipCallCount = 0;
    axiosInstance.get.mockImplementation((url: string) => {
      if (isHistoryUrl(url)) return Promise.resolve({ data: { data: [] } });
      slipCallCount += 1;
      if (slipCallCount === 1) return Promise.reject(new Error('Network Error'));
      return Promise.resolve(slipResponse());
    });
    renderPage();

    await user.click(screen.getByTestId('download-salary-slip'));
    expect(
      await screen.findByText(/we couldn't generate your salary slip/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('salary-slip-success')).toBeInTheDocument();
  });

  it('revokes the temporary object URL once the download has started', async () => {
    vi.useFakeTimers();
    try {
      renderPage();
      fireEvent.click(screen.getByTestId('download-salary-slip'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:salary-slip');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lists the persisted salary history with a download button per period', async () => {
    axiosInstance.get.mockImplementation((url: string) =>
      isHistoryUrl(url)
        ? Promise.resolve({ data: { data: HISTORY } })
        : Promise.resolve(slipResponse())
    );
    renderPage();

    expect(await screen.findByRole('heading', { name: /salary history/i })).toBeInTheDocument();
    expect(historyCalls()).toHaveLength(1);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 records
    expect(rows[1]).toHaveTextContent('July 2026');
    expect(rows[1]).toHaveTextContent(/12,500/);
    expect(rows[2]).toHaveTextContent('August 2026');

    expect(screen.getByTestId('download-slip-7-2026')).toBeInTheDocument();
    expect(screen.getByTestId('download-slip-8-2026')).toBeInTheDocument();
  });

  it('re-downloads a slip from history using that row’s month/year', async () => {
    const user = userEvent.setup();
    axiosInstance.get.mockImplementation((url: string) =>
      isHistoryUrl(url)
        ? Promise.resolve({ data: { data: HISTORY } })
        : Promise.resolve(slipResponse())
    );
    renderPage();

    await screen.findByText('July 2026');
    await user.click(screen.getByTestId('download-slip-7-2026'));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith(
        '/api/payroll/11/slip',
        expect.objectContaining({
          params: { month: 7, year: 2026, workerName: 'Ana' },
          responseType: 'blob',
        })
      );
    });
    expect(
      await screen.findByText(/salary slip for July 2026 downloaded/i)
    ).toBeInTheDocument();
  });

  it('shows the generating state only on the row being re-downloaded', async () => {
    let resolveDownload: (value: unknown) => void;
    axiosInstance.get.mockImplementation((url: string) =>
      isHistoryUrl(url)
        ? Promise.resolve({ data: { data: HISTORY } })
        : new Promise((resolve) => {
            resolveDownload = resolve;
          })
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('July 2026');
    await user.click(screen.getByTestId('download-slip-7-2026'));

    // Only the in-flight row spins; the other row and the header button
    // (different period) stay on their normal labels but are disabled.
    expect(screen.getByTestId('download-slip-7-2026')).toHaveTextContent('Generating…');
    expect(screen.getByTestId('download-slip-8-2026')).not.toHaveTextContent('Generating…');
    expect(screen.getByTestId('download-salary-slip')).not.toHaveTextContent('Generating…');
    expect(screen.getByTestId('download-salary-slip')).toBeDisabled();

    await act(async () => {
      resolveDownload(slipResponse());
    });
    expect(screen.getByTestId('download-slip-7-2026')).not.toHaveTextContent('Generating…');
  });

  it('refreshes the history after a successful download', async () => {
    const user = userEvent.setup();
    axiosInstance.get.mockImplementation((url: string) =>
      isHistoryUrl(url)
        ? Promise.resolve({ data: { data: [] } })
        : Promise.resolve(slipResponse())
    );
    renderPage();

    await waitFor(() => expect(historyCalls()).toHaveLength(1));
    await user.click(screen.getByTestId('download-salary-slip'));
    await screen.findByText(/salary slip for .* downloaded/i);

    // Generating a slip persists a SalaryRecord — the list is refetched.
    await waitFor(() => expect(historyCalls()).toHaveLength(2));
  });

  it('exports the payroll history as a CSV blob download', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('export-salary-history'));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith(
        '/api/payroll/11/history/export',
        expect.objectContaining({ responseType: 'blob' })
      );
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.download).toBe('salary-history-11-8-2026.csv');
    expect(await screen.findByTestId('csv-export-success')).toBeInTheDocument();
  });

  it('falls back to salary-history-{workerId}.csv when no Content-Disposition is sent', async () => {
    axiosInstance.get.mockImplementation((url: string) => {
      if (isExportUrl(url)) return Promise.resolve({ data: csvBlob(), headers: {} });
      if (isHistoryUrl(url)) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve(slipResponse());
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('export-salary-history'));

    await waitFor(() => expect(capturedAnchor).not.toBeNull());
    expect(capturedAnchor!.download).toBe('salary-history-11.csv');
  });

  it('shows an exporting state on the CSV button while the export runs', async () => {
    let resolveExport: (value: unknown) => void;
    axiosInstance.get.mockImplementation((url: string) => {
      if (isExportUrl(url)) {
        return new Promise((resolve) => {
          resolveExport = resolve;
        });
      }
      if (isHistoryUrl(url)) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve(slipResponse());
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('export-salary-history'));

    // Exporting is mutually exclusive with slip downloads.
    expect(screen.getByTestId('export-salary-history')).toBeDisabled();
    expect(screen.getByTestId('export-salary-history')).toHaveTextContent('Exporting…');
    expect(screen.getByTestId('download-salary-slip')).toBeDisabled();

    await act(async () => {
      resolveExport(csvResponse());
    });
    expect(screen.getByTestId('export-salary-history')).not.toHaveTextContent('Exporting…');
    expect(screen.getByTestId('csv-export-success')).toBeInTheDocument();
  });

  it('shows an error when the CSV export fails (blob error body)', async () => {
    axiosInstance.get.mockImplementation((url: string) => {
      if (isExportUrl(url)) {
        return Promise.reject({
          response: {
            status: 500,
            data: new Blob(
              [JSON.stringify({ message: 'Export service unavailable' })],
              { type: 'application/json' }
            ),
          },
        });
      }
      if (isHistoryUrl(url)) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve(slipResponse());
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('export-salary-history'));

    expect(await screen.findByText('Export service unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('csv-export-error')).toBeInTheDocument();
  });

  it('shows an empty state when no slips have been generated yet', async () => {
    renderPage();

    expect(await screen.findByText('No salary slips available yet')).toBeInTheDocument();
    // The empty state guides the worker to the attendance page.
    expect(screen.getByRole('link', { name: /view attendance/i })).toHaveAttribute(
      'href',
      '/worker/attendance'
    );
  });

  it('renders the summary cards and earnings chart from the history', async () => {
    axiosInstance.get.mockImplementation((url: string) =>
      isHistoryUrl(url)
        ? Promise.resolve({ data: { data: HISTORY } })
        : Promise.resolve(slipResponse())
    );
    renderPage();

    // Summary cards: current month (most recent = Aug ₹10,000), total
    // (₹22,500), and average (₹11,250 per month).
    expect(await screen.findByText('Current month salary')).toBeInTheDocument();
    expect(screen.getByText('Total earnings')).toBeInTheDocument();
    expect(screen.getByText('Average monthly income')).toBeInTheDocument();
    expect(screen.getByText('Pending payments')).toBeInTheDocument();
    // The current-month amount also appears in the history table row.
    expect(screen.getAllByText('₹10,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('₹22,500')).toBeInTheDocument();

    // Earnings chart section renders once there is history (the SVG itself
    // needs real layout, so the heading + Print action assert the section).
    expect(screen.getByText('Earnings growth')).toBeInTheDocument();

    // Print action is available alongside CSV.
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('shows an error with retry when the history cannot be loaded', async () => {
    const user = userEvent.setup();
    let historyCallCount = 0;
    axiosInstance.get.mockImplementation((url: string) => {
      if (isHistoryUrl(url)) {
        historyCallCount += 1;
        if (historyCallCount === 1) {
          return Promise.reject({
            response: { data: { message: 'Payroll service unavailable' } },
          });
        }
        return Promise.resolve({ data: { data: HISTORY } });
      }
      return Promise.resolve(slipResponse());
    });
    renderPage();

    expect(
      await screen.findByText('Payroll service unavailable')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('July 2026')).toBeInTheDocument();
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
