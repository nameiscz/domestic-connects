import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SubmitReview from './SubmitReview';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../api/axiosInstance', () => ({ default: axiosInstance }));

const CURRENT_USER = { id: 5, name: 'Mark', role: 'EMPLOYER' };

const WORKERS = [
  { id: 11, name: 'Ana', email: 'ana@example.com', role: 'WORKER', active: true },
  { id: 12, name: 'Ben', email: 'ben@example.com', role: 'WORKER', active: true },
];

// Mixed fixture: OPEN/CLOSED jobs, an ASSIGNED job for another worker, an
// ASSIGNED job from another employer and the employer's own ASSIGNED job for
// worker 11 — only the last one may be reviewed for Ana (id 11).
const JOBS = [
  { id: 1, title: 'Household Helper', employerId: 5, wagePerDay: 500, status: 'OPEN', workerId: null },
  { id: 3, title: 'Cook', employerId: 5, wagePerDay: 600, status: 'ASSIGNED', workerId: 11 },
  { id: 5, title: 'Driver', employerId: 5, wagePerDay: 700, status: 'ASSIGNED', workerId: 12 },
  { id: 2, title: 'Gardener', employerId: 7, wagePerDay: 400, status: 'ASSIGNED', workerId: 11 },
  { id: 4, title: 'Old Job', employerId: 5, wagePerDay: 300, status: 'CLOSED', workerId: 11 },
];

const renderSubmitReview = (currentUser = CURRENT_USER) => {
  useAuth.mockReturnValue({ currentUser });
  return render(
    <MemoryRouter>
      <SubmitReview />
    </MemoryRouter>
  );
};

const mockData = ({ workers = WORKERS, jobs = JOBS } = {}) => {
  axiosInstance.get.mockImplementation((url) => {
    if (url === '/api/auth/workers') {
      return Promise.resolve({ data: { data: workers } });
    }
    return Promise.resolve({ data: jobs });
  });
};

describe('SubmitReview', () => {
  beforeEach(() => {
    useAuth.mockReset();
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
    mockData();
  });

  it('only lists jobs actually assigned to the selected worker (own postings for employers)', async () => {
    const user = userEvent.setup();
    renderSubmitReview();

    await screen.findByLabelText('Worker');
    await user.selectOptions(screen.getByLabelText('Worker'), '11');

    // Cook is the employer's own ASSIGNED post for worker 11.
    const jobOptions = await screen.findByRole('option', { name: /cook/i });
    expect(jobOptions).toBeInTheDocument();

    // OPEN, CLOSED, a job assigned to another worker and another employer's
    // job are all excluded.
    expect(screen.queryByRole('option', { name: /household helper/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /driver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /gardener/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /old job/i })).not.toBeInTheDocument();
  });

  it('asks for a worker before offering any jobs', async () => {
    renderSubmitReview();

    await screen.findByLabelText('Worker');
    expect(screen.getByText(/choose a worker first/i)).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /cook/i })).not.toBeInTheDocument();
  });

  it('switches the job options to the new worker and clears a stale job selection', async () => {
    const user = userEvent.setup();
    renderSubmitReview();

    await screen.findByLabelText('Worker');
    await user.selectOptions(screen.getByLabelText('Worker'), '11');
    await user.selectOptions(await screen.findByLabelText('Job'), '3');
    expect(screen.getByLabelText('Job').value).toBe('3');

    // Switch to Ben (id 12) — the Driver job is his, Cook disappears and the
    // previously selected job is reset.
    await user.selectOptions(screen.getByLabelText('Worker'), '12');

    expect(await screen.findByRole('option', { name: /driver/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /cook/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Job').value).toBe('');
  });

  it('explains when the selected worker has no assigned jobs to review', async () => {
    mockData({ jobs: [JOBS[0]] }); // only an OPEN job exists
    const user = userEvent.setup();
    renderSubmitReview();

    await screen.findByLabelText('Worker');
    await user.selectOptions(screen.getByLabelText('Worker'), '11');

    expect(
      await screen.findByText(/no assigned jobs for ana/i)
    ).toBeInTheDocument();
  });

  it('validates required fields before submitting', async () => {
    const user = userEvent.setup();
    renderSubmitReview();

    await user.click(await screen.findByRole('button', { name: /submit review/i }));

    expect(screen.getByText('Select a worker.')).toBeInTheDocument();
    expect(screen.getByText('Select a job.')).toBeInTheDocument();
    expect(screen.getByText('Choose a rating from 1 to 5.')).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('posts the review with the selected rating and account name, then resets the form', async () => {
    const user = userEvent.setup();
    axiosInstance.post.mockResolvedValue({ data: { id: 501 } });
    renderSubmitReview();

    await screen.findByLabelText('Worker');
    await user.selectOptions(screen.getByLabelText('Worker'), '11');
    await user.selectOptions(screen.getByLabelText('Job'), '3');
    await user.click(screen.getByRole('radio', { name: 'Rate 4 out of 5' }));
    await user.type(screen.getByLabelText('Remarks'), 'Great with the kids');

    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(axiosInstance.post).toHaveBeenCalledWith('/api/performance/review', {
      workerId: 11,
      jobId: 3,
      rating: 4,
      remarks: 'Great with the kids',
      reviewedBy: 'Mark',
    });

    // Success toast names the worker and the form is reset.
    expect(
      await screen.findByText('Review submitted for Ana.')
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Worker').value).toBe('');
      // With no worker selected the job picker shows its hint again.
      expect(screen.getByText(/choose a worker first/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Remarks').value).toBe('');
    });
    expect(screen.getByRole('radio', { name: 'Rate 4 out of 5' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('shows an error toast and keeps the form filled when the POST fails', async () => {
    const user = userEvent.setup();
    axiosInstance.post.mockRejectedValue({
      response: { data: { message: 'Review already exists for this job' } },
    });
    renderSubmitReview();

    await screen.findByLabelText('Worker');
    await user.selectOptions(screen.getByLabelText('Worker'), '12');
    await user.selectOptions(screen.getByLabelText('Job'), '5'); // Driver — Ben's job
    await user.click(screen.getByRole('radio', { name: 'Rate 5 out of 5' }));

    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText('Review already exists for this job')).toBeInTheDocument();
    // The selections are kept so the reviewer can adjust and retry.
    expect(screen.getByLabelText('Worker').value).toBe('12');
    expect(screen.getByLabelText('Job').value).toBe('5');
    expect(screen.getByRole('radio', { name: 'Rate 5 out of 5' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('shows per-picker errors with retry when loading fails', async () => {
    const user = userEvent.setup();
    let calls = 0;
    axiosInstance.get.mockImplementation((url) => {
      calls += 1;
      if (url === '/api/auth/workers') {
        if (calls === 1) {
          return Promise.reject({ response: { data: { message: 'Workers unavailable' } } });
        }
        return Promise.resolve({ data: { data: WORKERS } });
      }
      return Promise.resolve({ data: JOBS });
    });
    renderSubmitReview();

    expect(await screen.findByText('Workers unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByLabelText('Worker')).toBeInTheDocument();
  });

  it('explains when the account id is missing', () => {
    renderSubmitReview(null);
    expect(screen.getByText(/account not recognised/i)).toBeInTheDocument();
  });
});
