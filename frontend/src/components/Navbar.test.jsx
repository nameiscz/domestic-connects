import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Navbar from './Navbar';

// Mock the auth context so tests control the signed-in user directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

let logoutMock;

const renderNavbar = ({
  role = 'WORKER',
  name = 'Ana',
  accent,
  currentUser = { id: 1, name, role },
  initialEntries = ['/worker'],
} = {}) => {
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
  });

  describe('role-based links', () => {
    it('renders the WORKER links with their destinations', () => {
      renderNavbar({ role: 'WORKER' });

      expect(screen.getByRole('link', { name: 'Jobs' })).toHaveAttribute(
        'href',
        '/worker/jobs'
      );
      expect(screen.getByRole('link', { name: 'My Attendance' })).toHaveAttribute(
        'href',
        '/worker/attendance'
      );
      expect(screen.getByRole('link', { name: 'My Salary Slips' })).toHaveAttribute(
        'href',
        '/worker/salary-slips'
      );
      expect(screen.getByRole('link', { name: 'My Performance' })).toHaveAttribute(
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
      expect(screen.getByRole('link', { name: 'My Attendance' })).not.toHaveClass('active');
    });

    it('highlights My Attendance while on /worker/attendance', () => {
      renderNavbar({ role: 'WORKER', initialEntries: ['/worker/attendance'] });

      expect(screen.getByRole('link', { name: 'My Attendance' })).toHaveClass('active');
      expect(screen.getByRole('link', { name: 'Jobs' })).not.toHaveClass('active');
    });

    it('does not highlight any link on the overview route', () => {
      renderNavbar({ role: 'WORKER', initialEntries: ['/worker'] });

      expect(screen.getByRole('link', { name: 'Jobs' })).not.toHaveClass('active');
      expect(screen.getByRole('link', { name: 'My Attendance' })).not.toHaveClass('active');
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
    it('shows the user’s name, role badge and a brand link to the role home', () => {
      renderNavbar({ role: 'WORKER', name: 'Ana' });

      expect(screen.getByText('Ana')).toBeInTheDocument();
      expect(screen.getByText('WORKER')).toBeInTheDocument(); // role badge
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

    it('applies the accent prop to the role badge', () => {
      // EMPLOYER would default to bg-success; passing a different accent
      // proves the prop is honoured over the role default.
      renderNavbar({ role: 'EMPLOYER', accent: 'info' });

      expect(screen.getByText('EMPLOYER')).toHaveClass('bg-info');
    });

    it('renders a minimal bar when there is no session', () => {
      renderNavbar({ currentUser: null });

      expect(screen.getByRole('link', { name: 'Domestic Connects' })).toHaveAttribute(
        'href',
        '/login'
      );
      expect(screen.queryByRole('link', { name: 'Jobs' })).not.toBeInTheDocument();
      expect(screen.queryByText('WORKER')).not.toBeInTheDocument();
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    });
  });

  describe('logout', () => {
    it('calls AuthContext.logout() and redirects to /login', async () => {
      const user = userEvent.setup();
      renderNavbar({ role: 'WORKER' });

      await user.click(screen.getByRole('button', { name: /log out/i }));

      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('Login Page')).toBeInTheDocument();
    });
  });
});
