import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobManagement from './JobManagement';

// Mock the axios instance so tests control every fetch directly.
const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const JOBS = [
  {
    id: 10,
    title: 'Household Helper',
    description: 'Help with cleaning and cooking.',
    employerId: 2,
    wagePerDay: 500,
    location: 'Bengaluru, Karnataka',
    status: 'OPEN',
    createdAt: '2026-08-01T10:00:00',
  },
  {
    id: 11,
    title: 'Elder Care',
    description: 'Companionship and medication reminders.',
    employerId: 2,
    wagePerDay: 800,
    location: 'Hyderabad, Telangana',
    status: 'ASSIGNED',
    createdAt: '2026-07-20T10:00:00',
  },
];

// More than one page (default page size is 10).
const MANY_JOBS = Array.from({ length: 12 }, (_, i) => ({
  id: 100 + i,
  title: `Job ${i + 1}`,
  description: `Description for job ${i + 1}.`,
  employerId: 2,
  wagePerDay: 500,
  location: 'Bengaluru, Karnataka',
  status: i % 2 === 0 ? 'OPEN' : 'ASSIGNED',
  createdAt: '2026-08-01T10:00:00',
}));

const renderPage = () => render(<JobManagement />);

describe('JobManagement', () => {
  beforeEach(() => {
    axiosInstance.get.mockReset();
    axiosInstance.delete.mockReset();
    axiosInstance.get.mockResolvedValue({ data: { data: JOBS } });
  });

  it('renders the jobs table with statuses and the open count', async () => {
    renderPage();

    expect(await screen.findByText('Household Helper')).toBeInTheDocument();
    expect(screen.getByText('Elder Care')).toBeInTheDocument();
    expect(screen.getByText('· 1 open of 2')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('opens a confirm modal, soft-deletes on confirmation and removes the row', async () => {
    axiosInstance.delete.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Household Helper');
    await user.click(screen.getByTestId('delete-10'));

    // The confirmation modal names the job being deleted.
    const modal = await screen.findByRole('dialog');
    expect(
      within(modal).getByText((content) => content.includes('Household Helper'))
    ).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: /delete job/i }));

    expect(axiosInstance.delete).toHaveBeenCalledWith('/api/jobs/10');
    await waitFor(() =>
      expect(screen.queryByText('Household Helper')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Elder Care')).toBeInTheDocument();
  });

  it('shows a toast and keeps the row when delete fails', async () => {
    axiosInstance.delete.mockRejectedValue({
      response: { data: { message: 'Job service unavailable' } },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Household Helper');
    await user.click(screen.getByTestId('delete-10'));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /delete job/i }));

    expect(await screen.findByText('Job service unavailable')).toBeInTheDocument();
    expect(screen.getByText('Household Helper')).toBeInTheDocument();
  });

  it('shows an error with retry when the list fails to load', async () => {
    let calls = 0;
    axiosInstance.get.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({ response: { data: { message: 'Admin service unavailable' } } });
      }
      return Promise.resolve({ data: { data: JOBS } });
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Admin service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Household Helper')).toBeInTheDocument();
  });

  it('shows an empty state when no jobs exist', async () => {
    axiosInstance.get.mockResolvedValue({ data: { data: [] } });
    renderPage();

    expect(await screen.findByRole('heading', { name: /no jobs posted yet/i })).toBeInTheDocument();
  });

  it('filters the table as the admin types a search', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Household Helper');
    await user.type(screen.getByRole('searchbox'), 'elder');

    expect(screen.getByText('Elder Care')).toBeInTheDocument();
    expect(screen.queryByText('Household Helper')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument();
  });

  it('paginates the table and lets the admin flip pages', async () => {
    axiosInstance.get.mockResolvedValue({ data: { data: MANY_JOBS } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Job 10');
    expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument();
    expect(screen.getByText('Job 10')).toBeInTheDocument();
    expect(screen.queryByText('Job 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText('Job 11')).toBeInTheDocument();
    expect(screen.getByText('Job 12')).toBeInTheDocument();
    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /previous page/i }));
    expect(screen.getByText('Job 10')).toBeInTheDocument();
    expect(screen.queryByText('Job 11')).not.toBeInTheDocument();
  });
});
