import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyPerformance from './MyPerformance';

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

const renderPage = () => {
  useAuth.mockReturnValue({ currentUser: CURRENT_USER });
  return render(<MyPerformance />);
};

describe('MyPerformance', () => {
  beforeEach(() => {
    useAuth.mockReset();
    axiosInstance.get.mockReset();
  });

  it('shows a spinner while the report loads', () => {
    axiosInstance.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('performance-loading')).toBeInTheDocument();
  });

  it('renders the average rating, review count and review rows', async () => {
    axiosInstance.get.mockResolvedValue({ data: REPORT });
    renderPage();

    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('Excellent work, very punctual.')).toBeInTheDocument();
    expect(screen.getByText('Great with the kids.')).toBeInTheDocument();
    expect(screen.getByText('Employer One')).toBeInTheDocument();
    // Both review rows + table header row.
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('renders the rating histogram with bucket counts', async () => {
    axiosInstance.get.mockResolvedValue({ data: REPORT });
    renderPage();

    expect(await screen.findByText('Rating breakdown')).toBeInTheDocument();
    // Buckets 1-5 each render their count column (0,0,0,1,1).
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getAllByText('1')).toHaveLength(2);
  });

  it('shows an empty state when the worker has no reviews', async () => {
    axiosInstance.get.mockResolvedValue({ data: EMPTY_REPORT });
    renderPage();

    expect(await screen.findByRole('heading', { name: /no reviews yet/i })).toBeInTheDocument();
  });

  it('shows an error with retry that recovers', async () => {
    let calls = 0;
    axiosInstance.get.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({ response: { data: { message: 'Service unavailable' } } });
      }
      return Promise.resolve({ data: REPORT });
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /couldn't load your performance/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('4.5')).toBeInTheDocument();
  });

  it('explains when the account id is missing', () => {
    useAuth.mockReturnValue({ currentUser: null });
    render(<MyPerformance />);
    expect(screen.getByText(/account not recognised/i)).toBeInTheDocument();
  });

  it('aborts in-flight fetches on unmount', async () => {
    const controllerAbort = vi.fn();
    axiosInstance.get.mockImplementation((url, { signal } = {}) => {
      signal?.addEventListener('abort', controllerAbort);
      return new Promise(() => {});
    });
    const { unmount } = renderPage();
    unmount();
    await waitFor(() => expect(controllerAbort).toHaveBeenCalled());
  });
});
