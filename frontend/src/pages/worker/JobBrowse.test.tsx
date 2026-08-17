import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobBrowse from './JobBrowse';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const WORKER = { id: 27, name: 'Manideep', role: 'WORKER' };

const JOBS = [
  {
    id: 1,
    title: 'Household Helper',
    description: 'Daily cleaning and cooking for a family of four.',
    employerId: 5,
    wagePerDay: 500,
    location: 'Bengaluru',
    status: 'OPEN',
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 2,
    title: 'Gardener',
    description: 'Weekly gardening for a villa.',
    employerId: 7,
    wagePerDay: 400,
    location: 'Mysuru',
    status: 'ASSIGNED',
    createdAt: '2026-08-02T10:00:00Z',
  },
];

describe('JobBrowse apply flow', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ currentUser: WORKER });
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.get.mockResolvedValue({ data: JOBS });
  });

  it('shows open and assigned jobs with their statuses', async () => {
    render(<JobBrowse />);

    expect(await screen.findByText('Household Helper')).toBeInTheDocument();
    expect(screen.getByText('Gardener')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('applies via /apply, does not assign, and marks the job as applied', async () => {
    const user = userEvent.setup();
    axiosInstance.post.mockResolvedValue({
      data: { id: 21, jobId: 1, workerId: 27, status: 'PENDING' },
    });
    render(<JobBrowse />);

    const applyBtn = await screen.findByRole('button', { name: 'Apply' });
    await user.click(applyBtn);

    // The worker's apply is a PENDING application — NOT a self-assignment.
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/jobs/1/apply');
    expect(
      await screen.findByText(/Application sent for "Household Helper"/)
    ).toBeInTheDocument();

    // The job card reflects the pending state: button disabled, badge shown.
    expect(
      screen.getByRole('button', { name: /applied — awaiting review/i })
    ).toBeDisabled();
    expect(screen.getByText('Application sent')).toBeInTheDocument();
    // The applied job is still OPEN (the worker wasn't assigned) — the card
    // still shows the Open status pill and the "Application sent" badge.
    const card = applyBtn.closest('.card') as HTMLElement;
    expect(within(card).getByText('Open')).toBeInTheDocument();
    expect(within(card).getByText('Application sent')).toBeInTheDocument();
  });

  it('shows an error toast when the application fails', async () => {
    const user = userEvent.setup();
    axiosInstance.post.mockRejectedValue({
      response: { data: { message: 'This job is no longer accepting applications.' } },
    });
    render(<JobBrowse />);

    const applyBtn = await screen.findByRole('button', { name: 'Apply' });
    await user.click(applyBtn);

    expect(
      await screen.findByText('This job is no longer accepting applications.')
    ).toBeInTheDocument();
    // The Apply button stays available for retry.
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(
      within(applyBtn.closest('.card') as HTMLElement).getByText('Apply')
    ).toBeInTheDocument();
  });

  it('filters the grid by location', async () => {
    const user = userEvent.setup();
    render(<JobBrowse />);

    await screen.findByText('Household Helper');

    await user.selectOptions(screen.getByLabelText('Filter by location'), 'Mysuru');

    expect(screen.getByText('Gardener')).toBeInTheDocument();
    expect(screen.queryByText('Household Helper')).not.toBeInTheDocument();
  });

  it('shows a “Recommended for you” section for open jobs and hides them from the main grid', async () => {
    render(<JobBrowse />);

    // Both fixtures are ranked: the OPEN job is recommended, the ASSIGNED one
    // appears under "All jobs".
    expect(await screen.findByText('Recommended for you')).toBeInTheDocument();
    expect(screen.getByText('All jobs')).toBeInTheDocument();

    // Only one card per job — recommended jobs are not duplicated.
    expect(screen.getAllByText('Household Helper')).toHaveLength(1);
    expect(screen.getAllByText('Gardener')).toHaveLength(1);
  });

  it('saves and unsaves a job with the bookmark button', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    render(<JobBrowse />);

    const saveBtn = await screen.findByRole('button', { name: 'Save Household Helper' });
    expect(saveBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(saveBtn);

    expect(
      await screen.findByText('Saved "Household Helper" for later.')
    ).toBeInTheDocument();
    expect(saveBtn).toHaveAttribute('aria-pressed', 'true');

    // Persisted under the worker's key.
    expect(JSON.parse(localStorage.getItem('dc_saved_jobs_27') ?? '[]')).toEqual([1]);

    await user.click(screen.getByRole('button', { name: 'Unsave Household Helper' }));
    expect(screen.getByText('Removed "Household Helper" from saved jobs.')).toBeInTheDocument();
  });

  it('paginates when more than PAGE_SIZE jobs are shown', async () => {
    const user = userEvent.setup();
    const manyJobs = Array.from({ length: 8 }, (_, i) => ({
      id: i + 10,
      title: `Job ${i + 1}`,
      description: 'A job listing.',
      employerId: 5,
      wagePerDay: 400 + i,
      location: i % 2 === 0 ? 'Bengaluru' : 'Mysuru',
      status: 'CLOSED',
      createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));
    axiosInstance.get.mockResolvedValue({ data: manyJobs });
    render(<JobBrowse />);

    expect(await screen.findByText('Job 1')).toBeInTheDocument();
    expect(screen.queryByText('Job 7')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('Job 7')).toBeInTheDocument();
    expect(screen.queryByText('Job 1')).not.toBeInTheDocument();
  });
});
