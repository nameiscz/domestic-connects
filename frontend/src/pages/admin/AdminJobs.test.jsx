import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminJobs from './AdminJobs';

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

const renderPage = () => render(<AdminJobs />);

describe('AdminJobs', () => {
  beforeEach(() => {
    axiosInstance.get.mockReset();
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
});
