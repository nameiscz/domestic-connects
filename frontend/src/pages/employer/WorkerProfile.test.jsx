import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WorkerProfile from './WorkerProfile';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const EMPLOYER = { id: 5, name: 'Mark', role: 'EMPLOYER' };

const REPORT = {
  workerId: 11,
  reviewCount: 2,
  averageRating: 4.5,
  ratingDistribution: [
    { rating: 5, count: 1 },
    { rating: 4, count: 1 },
    { rating: 3, count: 0 },
    { rating: 2, count: 0 },
    { rating: 1, count: 0 },
  ],
  reviews: [
    { id: 1, rating: 5, remarks: 'Excellent', reviewedBy: 'Mark', jobId: 3, createdAt: '2026-08-01T10:00:00Z' },
  ],
  page: 0,
  size: 10,
  totalPages: 1,
  totalElements: 2,
};

const ATTENDANCE = {
  summary: { presentDays: 3, halfDays: 1, absentDays: 0, totalDays: 4 },
  records: [],
};

const OPEN_JOBS = [
  { id: 1, title: 'Household Helper', employerId: 5, wagePerDay: 500, status: 'OPEN', createdAt: '2026-08-01T10:00:00Z' },
  { id: 2, title: 'Gardener', employerId: 7, wagePerDay: 400, status: 'OPEN', createdAt: '2026-08-02T10:00:00Z' },
];

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={['/employer/workers/11']}>
      <Routes>
        <Route path="/employer/workers/:id" element={<WorkerProfile />} />
        <Route path="/employer/jobs" element={<div>My Job Posts</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('WorkerProfile (employer view)', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ currentUser: EMPLOYER });
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: [{ id: 11, name: 'Ana', email: 'ana@example.com', role: 'WORKER', active: true }] } });
      }
      if (url.startsWith('/api/performance/worker/11')) {
        return Promise.resolve({ data: REPORT });
      }
      if (url.startsWith('/api/attendance/worker/11')) {
        return Promise.resolve({ data: ATTENDANCE });
      }
      if (url === '/api/jobs') {
        return Promise.resolve({ data: OPEN_JOBS });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders the worker identity, rating summary, attendance and review history', async () => {
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Worker profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();

    // Rating summary
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText(/2 reviews/)).toBeInTheDocument();
    expect(screen.getByText('“Excellent”')).toBeInTheDocument();

    // Attendance
    expect(screen.getByRole('heading', { name: /attendance/i })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Review history table
    expect(screen.getByRole('heading', { name: 'Review history' })).toBeInTheDocument();
    expect(screen.getByText('Mark')).toBeInTheDocument();
  });

  it('assigns the worker to an open job via the reviewed endpoint', async () => {
    const user = userEvent.setup();
    axiosInstance.post.mockResolvedValue({ data: { id: 1, status: 'ASSIGNED' } });
    renderProfile();

    await screen.findByRole('heading', { name: 'Ana' });

    const assignCard = screen.getByRole('heading', { name: /assign to a job/i }).closest('.card');
    await user.selectOptions(within(assignCard).getByLabelText('Job to assign'), '1');
    await user.click(within(assignCard).getByRole('button', { name: /assign this worker/i }));

    expect(axiosInstance.post).toHaveBeenCalledWith('/api/jobs/1/assign/11/reviewed');
    expect(await screen.findByText('My Job Posts')).toBeInTheDocument();
  });

  it('shows an error state when the worker is not found', async () => {
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: null });
    });
    renderProfile();

    expect(await screen.findByText('Worker not found.')).toBeInTheDocument();
  });
});
