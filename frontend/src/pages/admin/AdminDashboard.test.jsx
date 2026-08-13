import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';

// Mock auth context (used by the Navbar shell) and axios instance.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const CURRENT_USER = { id: 1, name: 'Adri', role: 'ADMIN' };

const SUMMARY = {
  totalUsers: 20,
  activeUsers: 15,
  totalJobs: 12,
  activeJobs: 9,
  inactiveJobs: 3,
  monthlyAttendanceRate: 78.5,
  averagePerformanceRating: 4.2,
  totalReviews: 24,
};

const renderPage = (currentUser = CURRENT_USER) => {
  useAuth.mockReturnValue({ currentUser });
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={<AdminDashboard />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    useAuth.mockReset();
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
    axiosInstance.get.mockResolvedValue({ data: { data: SUMMARY } });
  });

  it('renders the summary cards with values and the review count', async () => {
    renderPage();

    expect(await screen.findByText('20')).toBeInTheDocument(); // total users
    expect(screen.getByText('15 active')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument(); // total jobs
    expect(screen.getByText('9 active')).toBeInTheDocument();
    expect(screen.getByText('78.5%')).toBeInTheDocument();
    expect(screen.getByText('4.20 / 5')).toBeInTheDocument();
    expect(screen.getByText('24 reviews across workers')).toBeInTheDocument();
  });

  it('renders the section quick links with their destinations', async () => {
    renderPage();

    await screen.findByText('Total users');
    // Navbar duplicates some labels, so every matching link must point home.
    for (const label of ['Users', 'Jobs', 'Attendance', 'Analytics']) {
      const links = screen.getAllByRole('link', { name: label });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0]).toHaveAttribute('href', `/admin/${label.toLowerCase()}`);
    }
    expect(screen.getByText('Manage accounts')).toBeInTheDocument();
    expect(screen.getByText('Platform KPIs')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view analytics/i })).toHaveAttribute(
      'href',
      '/admin/analytics'
    );
  });

  it('shows a spinner while the summary loads', () => {
    axiosInstance.get.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('admin-dashboard-loading')).toBeInTheDocument();
  });

  it('shows dashes and fallback notes when metrics are unavailable', async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        data: {
          ...SUMMARY,
          monthlyAttendanceRate: null,
          averagePerformanceRating: null,
          totalReviews: null,
        },
      },
    });
    renderPage();

    // Attendance rate + average rating render as dashes.
    expect(await screen.findAllByText('—')).toHaveLength(2);
    expect(screen.getByText('Across workers')).toBeInTheDocument();
  });

  it('shows an error with a reload link when the summary fails to load', async () => {
    axiosInstance.get.mockRejectedValue({
      response: { data: { message: 'Admin service unavailable' } },
    });
    renderPage();

    expect(await screen.findByText('Admin service unavailable')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /couldn't load the summary/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reload/i })).toHaveAttribute('href', '/admin');
  });
});
