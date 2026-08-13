import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ManageReviews from './ManageReviews';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../api/axiosInstance', () => ({ default: axiosInstance }));

const EMPLOYER_USER = { id: 5, name: 'Mark', role: 'EMPLOYER' };
const ADMIN_USER = { id: 1, name: 'Admin', role: 'ADMIN' };

const WORKERS = [
  { id: 11, name: 'Ana', email: 'ana@example.com', role: 'WORKER', active: true },
  { id: 12, name: 'Ben', email: 'ben@example.com', role: 'WORKER', active: true },
];

const REPORT = {
  workerId: 11,
  reviewCount: 2,
  averageRating: 4.5,
  reviews: [
    {
      id: 301,
      workerId: 11,
      jobId: 10,
      rating: 5,
      remarks: 'Excellent work, very punctual.',
      reviewedBy: 'Employer One',
      createdAt: '2026-08-01T10:00:00',
    },
    {
      id: 302,
      workerId: 11,
      jobId: 12,
      rating: 4,
      remarks: 'Great with the kids.',
      reviewedBy: 'Employer Two',
      createdAt: '2026-07-15T09:00:00',
    },
  ],
  ratingDistribution: [
    { rating: 1, count: 0 },
    { rating: 2, count: 0 },
    { rating: 3, count: 0 },
    { rating: 4, count: 1 },
    { rating: 5, count: 1 },
  ],
  page: 0,
  size: 2,
  totalPages: 1,
  totalElements: 2,
};

const EMPTY_REPORT = {
  workerId: 11,
  reviewCount: 0,
  averageRating: null,
  reviews: [],
  ratingDistribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
  page: 0,
  size: 0,
  totalPages: 0,
  totalElements: 0,
};

const renderPage = (currentUser = EMPLOYER_USER) => {
  useAuth.mockReturnValue({ currentUser });
  return render(
    <MemoryRouter>
      <ManageReviews />
    </MemoryRouter>
  );
};

// Default mock: workers (auth envelope) + the performance report.
const mockData = ({ report = REPORT } = {}) => {
  axiosInstance.get.mockImplementation((url) => {
    if (url === '/api/auth/workers') {
      return Promise.resolve({ data: { data: WORKERS } });
    }
    if (url.startsWith('/api/performance/worker/')) {
      return Promise.resolve({ data: report });
    }
    return Promise.resolve({ data: [] });
  });
};

const selectWorker = async (user, workerId) => {
  await screen.findByLabelText('Worker');
  await user.selectOptions(screen.getByLabelText('Worker'), String(workerId));
};

const reportCallsFor = () =>
  axiosInstance.get.mock.calls.filter(([url]) => url.includes('/api/performance/worker/'));

describe('ManageReviews', () => {
  beforeEach(() => {
    useAuth.mockReset();
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
    mockData();
  });

  it('loads the selected worker’s report with the summary and review rows', async () => {
    const user = userEvent.setup();
    renderPage();

    await selectWorker(user, 11);

    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('Excellent work, very punctual.')).toBeInTheDocument();
    expect(screen.getByText('Great with the kids.')).toBeInTheDocument();
    expect(screen.getByText('Employer One')).toBeInTheDocument();
    // Table header + one row per review.
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('shows an empty state with a submit-review shortcut when the worker has no reviews', async () => {
    mockData({ report: EMPTY_REPORT });
    const user = userEvent.setup();
    renderPage();

    await selectWorker(user, 11);

    expect(
      await screen.findByRole('heading', { name: /no reviews yet/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /submit the first review/i })).toHaveAttribute(
      'href',
      '/employer/reviews/new'
    );
  });

  it('opens the edit modal prefilled, PUTs rating/remarks and refreshes the report', async () => {
    const user = userEvent.setup();
    axiosInstance.put.mockResolvedValue({ data: { id: 301 } });
    renderPage();

    await selectWorker(user, 11);
    await user.click((await screen.findAllByRole('button', { name: /edit/i }))[0]);

    const modal = await screen.findByRole('dialog');
    // Prefilled with the existing review's data.
    expect(modal).toHaveTextContent('Employer One');
    expect(within(modal).getByLabelText('Remarks').value).toBe('Excellent work, very punctual.');
    expect(within(modal).getByRole('radio', { name: 'Rate 5 out of 5' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await user.click(within(modal).getByRole('radio', { name: 'Rate 3 out of 5' }));
    await user.clear(within(modal).getByLabelText('Remarks'));
    await user.type(within(modal).getByLabelText('Remarks'), 'Could improve on punctuality.');
    await user.click(within(modal).getByRole('button', { name: /save changes/i }));

    expect(axiosInstance.put).toHaveBeenCalledWith('/api/performance/review/301', {
      rating: 3,
      remarks: 'Could improve on punctuality.',
    });
    expect(await screen.findByText('Review updated.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The success refreshed the report for the same worker.
    await waitFor(() => expect(reportCallsFor().length).toBeGreaterThanOrEqual(2));
  });

  it('keeps the edit modal open with an error toast when the PUT fails', async () => {
    const user = userEvent.setup();
    axiosInstance.put.mockRejectedValue({
      response: { data: { message: 'Review was edited elsewhere' } },
    });
    renderPage();

    await selectWorker(user, 11);
    await user.click((await screen.findAllByRole('button', { name: /edit/i }))[0]);

    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Review was edited elsewhere')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows Edit but hides Delete for employers', async () => {
    const user = userEvent.setup();
    renderPage(EMPLOYER_USER);

    await selectWorker(user, 11);
    await screen.findByText('4.5');
    expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows both Edit and Delete for admins', async () => {
    const user = userEvent.setup();
    renderPage(ADMIN_USER);

    await selectWorker(user, 11);
    await screen.findByText('4.5');
    expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2);
  });

  it('confirms before deleting and DELETEs the review as an admin', async () => {
    const user = userEvent.setup();
    axiosInstance.delete.mockResolvedValue({ data: { message: 'deleted' } });
    renderPage(ADMIN_USER);

    await selectWorker(user, 11);
    await user.click((await screen.findAllByRole('button', { name: /delete/i }))[0]);

    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent(/permanently delete/i);
    expect(modal).toHaveTextContent('Employer One');

    await user.click(within(modal).getByRole('button', { name: /delete review/i }));

    expect(axiosInstance.delete).toHaveBeenCalledWith('/api/performance/review/301');
    expect(await screen.findByText('Review deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(reportCallsFor().length).toBeGreaterThanOrEqual(2));
  });

  it('shows an error with retry when the report fails to load', async () => {
    const user = userEvent.setup();
    let reportCalls = 0;
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url.startsWith('/api/performance/worker/')) {
        reportCalls += 1;
        if (reportCalls === 1) {
          return Promise.reject({
            response: { data: { message: 'Performance service unavailable' } },
          });
        }
        return Promise.resolve({ data: REPORT });
      }
      return Promise.resolve({ data: [] });
    });
    renderPage();

    await selectWorker(user, 11);

    expect(
      await screen.findByRole('heading', { name: /couldn't load the report/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Performance service unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('4.5')).toBeInTheDocument();
  });

  it('explains when the account id is missing', () => {
    renderPage(null);
    expect(screen.getByText(/account not recognised/i)).toBeInTheDocument();
  });
});
