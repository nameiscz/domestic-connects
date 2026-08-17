import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Navbar from './Navbar';

// Mock the auth context so tests control the signed-in user directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

// Mock axios so the unread-count hook is fully controlled.
const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn() },
}));
vi.mock('../api/axiosInstance', () => ({ default: axiosInstance }));

// Worker notifications returned by GET /api/notifications/{userId}.
const NOTIFICATIONS = [
  { id: 401, message: 'Job assigned', type: 'JOB_ASSIGNED', isRead: false },
  { id: 402, message: 'Salary slip ready', type: 'SALARY_SLIP_GENERATED', isRead: true },
];

let logoutMock: ReturnType<typeof vi.fn>;

interface NavbarTestOptions {
  role?: string;
  name?: string;
  accent?: string;
  currentUser?: { id: number; name: string; role: string } | null;
  initialEntries?: string | string[];
}

const renderNavbar = ({
  role = 'WORKER',
  name = 'Ana',
  accent,
  currentUser = { id: 1, name, role },
  initialEntries = ['/worker'],
}: NavbarTestOptions = {}) => {
  useAuth.mockReturnValue({
    currentUser,
    logout: logoutMock,
  });

  return render(
    <MemoryRouter
      initialEntries={Array.isArray(initialEntries) ? initialEntries : [initialEntries]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        {/* Rendered after logout so the redirect can be asserted. */}
        <Route path="/login" element={<div>Login Page</div>} />
        {/* The navbar renders on every other path via the catch-all. */}
        <Route path="*" element={<Navbar accent={accent} />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Navbar', () => {
  beforeEach(() => {
    logoutMock = vi.fn();
    axiosInstance.get.mockReset();
    // Default: no unread notifications, so badge-free navbars stay quiet.
    axiosInstance.get.mockResolvedValue({ data: [] });
  });

  describe('role-based links', () => {
    it('renders the WORKER links with their destinations', () => {
      renderNavbar({ role: 'WORKER' });

      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/worker'
      );
      expect(screen.getByRole('link', { name: 'Jobs' })).toHaveAttribute(
        'href',
        '/worker/jobs'
      );
      expect(screen.getByRole('link', { name: 'Attendance' })).toHaveAttribute(
        'href',
        '/worker/attendance'
      );
      expect(screen.getByRole('link', { name: 'Salary' })).toHaveAttribute(
        'href',
        '/worker/salary-slips'
      );
      expect(screen.getByRole('link', { name: 'Performance' })).toHaveAttribute(
        'href',
        '/worker/performance'
      );
      expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
        'href',
        '/worker/notifications'
      );

      // Other roles' links must not leak into the worker menu.
      expect(screen.queryByRole('link', { name: 'Post Job' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    });

    it('renders the EMPLOYER links with their destinations', () => {
      renderNavbar({ role: 'EMPLOYER' });

      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/employer'
      );
      expect(screen.getByRole('link', { name: 'Post Job' })).toHaveAttribute(
        'href',
        '/employer/jobs/new'
      );
      expect(screen.getByRole('link', { name: 'My Job Posts' })).toHaveAttribute(
        'href',
        '/employer/jobs'
      );

      expect(screen.queryByRole('link', { name: 'Jobs' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Audit Logs' })).not.toBeInTheDocument();
    });

    it('renders the ADMIN links with their destinations', () => {
      renderNavbar({ role: 'ADMIN' });

      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/admin'
      );
      expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute(
        'href',
        '/admin/users'
      );
      expect(screen.getByRole('link', { name: 'Jobs' })).toHaveAttribute(
        'href',
        '/admin/jobs'
      );
      expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute(
        'href',
        '/admin/analytics'
      );
      expect(screen.getByRole('link', { name: 'Audit Logs' })).toHaveAttribute(
        'href',
        '/admin/audit-logs'
      );

      expect(screen.queryByRole('link', { name: 'My Attendance' })).not.toBeInTheDocument();
    });
  });

  describe('active states', () => {
    it('highlights Jobs while on /worker/jobs', () => {
      renderNavbar({ role: 'WORKER', initialEntries: ['/worker/jobs'] });

      expect(screen.getByRole('link', { name: 'Jobs' })).toHaveClass('active');
      expect(screen.getByRole('link', { name: 'Attendance' })).not.toHaveClass('active');
    });

    it('highlights Attendance while on /worker/attendance', () => {
      renderNavbar({ role: 'WORKER', initialEntries: ['/worker/attendance'] });

      expect(screen.getByRole('link', { name: 'Attendance' })).toHaveClass('active');
      expect(screen.getByRole('link', { name: 'Jobs' })).not.toHaveClass('active');
    });

    it('highlights the Dashboard link while on the overview route', () => {
      renderNavbar({ role: 'WORKER', initialEntries: ['/worker'] });

      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('active');
      expect(screen.getByRole('link', { name: 'Jobs' })).not.toHaveClass('active');
      expect(screen.getByRole('link', { name: 'Attendance' })).not.toHaveClass('active');
    });

    it('highlights Post Job but not My Job Posts while on the post form', () => {
      renderNavbar({ role: 'EMPLOYER', initialEntries: ['/employer/jobs/new'] });

      expect(screen.getByRole('link', { name: 'Post Job' })).toHaveClass('active');
      expect(screen.getByRole('link', { name: 'My Job Posts' })).not.toHaveClass('active');
    });

    it('highlights My Job Posts but not Post Job while on the jobs list', () => {
      renderNavbar({ role: 'EMPLOYER', initialEntries: ['/employer/jobs'] });

      expect(screen.getByRole('link', { name: 'My Job Posts' })).toHaveClass('active');
      expect(screen.getByRole('link', { name: 'Post Job' })).not.toHaveClass('active');
    });
  });

  describe('user identity', () => {
    it('shows the user’s name and a brand link to the role home', () => {
      renderNavbar({ role: 'WORKER', name: 'Ana' });

      expect(screen.getByText('Ana')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Domestic Connects' })).toHaveAttribute(
        'href',
        '/worker'
      );
    });

    it('points the brand link to the employer home for employers', () => {
      renderNavbar({ role: 'EMPLOYER', name: 'Mark' });

      expect(screen.getByRole('link', { name: 'Domestic Connects' })).toHaveAttribute(
        'href',
        '/employer'
      );
    });

    it('opens the profile dropdown with theme and logout actions', async () => {
      const user = userEvent.setup();
      renderNavbar({ role: 'WORKER', name: 'Ana' });

      // The profile menu is closed by default.
      expect(screen.queryByRole('menuitem', { name: /log out/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Ana/i }));

      expect(await screen.findByRole('menuitem', { name: /my profile/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /dark mode|light mode/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument();
    });

    it('renders a minimal bar when there is no session', () => {
      renderNavbar({ currentUser: null });

      expect(screen.getByRole('link', { name: 'Domestic Connects' })).toHaveAttribute(
        'href',
        '/login'
      );
      expect(screen.queryByRole('link', { name: 'Jobs' })).not.toBeInTheDocument();
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });
  });

  describe('notification bell badge', () => {
    it('shows the unread count on the bell for workers with unread items', async () => {
      axiosInstance.get.mockResolvedValue({ data: NOTIFICATIONS });
      renderNavbar({ role: 'WORKER' });

      const bell = await screen.findByRole('link', { name: 'Notifications, 1 unread' });
      expect(bell).toHaveAttribute('href', '/worker/notifications');
      expect(screen.getByTestId('unread-notifications-badge')).toHaveTextContent('1');
    });

    it('hides the badge when there are no unread notifications', async () => {
      renderNavbar({ role: 'WORKER' });

      const bell = await screen.findByRole('link', { name: 'Notifications, 0 unread' });
      expect(bell).toHaveAttribute('href', '/worker/notifications');
      expect(screen.queryByTestId('unread-notifications-badge')).not.toBeInTheDocument();
    });

    it('caps the badge at 99+', async () => {
      axiosInstance.get.mockResolvedValue({
        data: Array.from({ length: 120 }, (_, i) => ({
          id: i + 1,
          message: `Notification ${i + 1}`,
          type: 'JOB_ASSIGNED',
          isRead: false,
        })),
      });
      renderNavbar({ role: 'WORKER' });

      expect(
        await waitFor(() =>
          expect(screen.getByTestId('unread-notifications-badge')).toHaveTextContent('99+')
        )
      ).toBeTruthy();
    });

    it('does not render a bell for employers', () => {
      renderNavbar({ role: 'EMPLOYER' });
      expect(screen.queryByRole('link', { name: /notifications/i })).not.toBeInTheDocument();
      expect(axiosInstance.get).not.toHaveBeenCalled();
    });

    it('does not render a bell for admins', () => {
      renderNavbar({ role: 'ADMIN' });
      expect(screen.queryByRole('link', { name: /notifications/i })).not.toBeInTheDocument();
      expect(axiosInstance.get).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('calls AuthContext.logout() and redirects to /login from the profile menu', async () => {
      const user = userEvent.setup();
      renderNavbar({ role: 'WORKER' });

      // Logout now lives inside the profile dropdown.
      await user.click(screen.getByRole('button', { name: /Ana/i }));
      await user.click(await screen.findByRole('menuitem', { name: /log out/i }));

      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('Login Page')).toBeInTheDocument();
    });
  });
});
