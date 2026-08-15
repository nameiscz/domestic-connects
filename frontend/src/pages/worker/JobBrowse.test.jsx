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
    const card = applyBtn.closest('.card');
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
    expect(within(applyBtn.closest('.card')).getByText('Apply')).toBeInTheDocument();
  });
});
