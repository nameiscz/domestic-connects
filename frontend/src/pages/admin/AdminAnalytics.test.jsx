import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminAnalytics from './AdminAnalytics';

// Mock the axios instance so tests control every fetch directly.
const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const ANALYTICS = {
  usersByRole: { ADMIN: 1, EMPLOYER: 2, WORKER: 10 },
  jobsByStatus: { OPEN: 4, ASSIGNED: 2, CLOSED: 1 },
  activeJobs: 6,
  inactiveJobs: 1,
  monthlyAttendanceRate: 87.5,
  averagePerformanceRating: 4.2,
};

const renderPage = () => render(<AdminAnalytics />);

describe('AdminAnalytics', () => {
  beforeEach(() => {
    axiosInstance.get.mockReset();
    axiosInstance.get.mockResolvedValue({ data: { data: ANALYTICS } });
  });

  it('renders the headline KPIs', async () => {
    renderPage();

    expect(await screen.findByText('13')).toBeInTheDocument(); // total users
    expect(screen.getByText('7')).toBeInTheDocument(); // total jobs
    expect(screen.getByText('87.5%')).toBeInTheDocument();
    expect(screen.getByText('4.20 / 5')).toBeInTheDocument();
  });

  it('renders the users-by-role and jobs-by-status breakdowns', async () => {
    renderPage();

    expect(await screen.findByText('Workers')).toBeInTheDocument();
    expect(screen.getByText('Employers')).toBeInTheDocument();
    expect(screen.getByText('Admins')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('shows an error with retry when analytics fail to load', async () => {
    let calls = 0;
    axiosInstance.get.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({ response: { data: { message: 'Admin service unavailable' } } });
      }
      return Promise.resolve({ data: { data: ANALYTICS } });
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Admin service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('87.5%')).toBeInTheDocument();
  });
});
