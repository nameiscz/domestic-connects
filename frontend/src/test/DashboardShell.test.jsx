import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Regression test for the double-<Outlet /> bug: the role dashboards used to
// pass their own <Outlet /> into <DashboardLayout />, which renders one itself,
// so every nested page (e.g. /worker/performance) mounted twice. These tests
// render the real route structure from App.jsx (ProtectedRoute → dashboard →
// nested page) and assert each page appears exactly once. Re-adding a second
// <Outlet /> anywhere makes them fail.
import ProtectedRoute from '../components/ProtectedRoute';
import WorkerDashboard from '../pages/worker/WorkerDashboard';
import EmployerDashboard from '../pages/employer/EmployerDashboard';
import AdminDashboard from '../pages/admin/AdminDashboard';
import MyPerformance from '../pages/worker/MyPerformance';
import Notifications from '../pages/worker/Notifications';
import MyJobPosts from '../pages/employer/MyJobPosts';
import UserManagement from '../pages/admin/UserManagement';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../api/axiosInstance', () => ({ default: axiosInstance }));

const WORKER = { id: 11, name: 'Ana', role: 'WORKER' };
const EMPLOYER = { id: 5, name: 'Mark', role: 'EMPLOYER' };
const ADMIN = { id: 1, name: 'Root', role: 'ADMIN' };

const PERFORMANCE_HISTORY = {
  reviews: [],
  ratingDistribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
  reviewCount: 0,
  averageRating: null,
  totalPages: 1,
  totalElements: 0,
  page: 0,
};

// Default empty-data responses for every endpoint the shell + pages touch, so
// pages render their (single) empty states rather than loading forever.
const mockApi = () => {
  axiosInstance.get.mockImplementation((url) => {
    if (url === '/api/jobs') return Promise.resolve({ data: [] });
    if (url.startsWith('/api/payroll/')) return Promise.resolve({ data: { data: [] } });
    if (url.startsWith('/api/attendance/')) return Promise.resolve({ data: { summary: null, records: [] } });
    if (url.startsWith('/api/performance/worker/')) return Promise.resolve({ data: PERFORMANCE_HISTORY });
    if (url.startsWith('/api/notifications/')) return Promise.resolve({ data: [] });
    if (url === '/api/auth/workers') return Promise.resolve({ data: { data: [] } });
    if (url === '/api/admin/dashboard/summary') return Promise.resolve({ data: { data: {} } });
    if (url === '/api/admin/users') return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: [] });
  });
};

// main.jsx mounts the app inside <React.StrictMode>, so render through it too
// (double-mounting must not duplicate the DOM — exactly what these tests guard).
const renderShell = (ui) => render(<React.StrictMode>{ui}</React.StrictMode>);

const renderWorkerShell = (initialPath = '/worker/performance') => {
  useAuth.mockReturnValue({ currentUser: WORKER });
  return renderShell(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/worker"
          element={
            <ProtectedRoute allowedRoles={['WORKER']}>
              <WorkerDashboard />
            </ProtectedRoute>
          }
        >
          <Route path="performance" element={<MyPerformance />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

const renderEmployerShell = () => {
  useAuth.mockReturnValue({ currentUser: EMPLOYER });
  return renderShell(
    <MemoryRouter initialEntries={['/employer/jobs']}>
      <Routes>
        <Route
          path="/employer"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYER']}>
              <EmployerDashboard />
            </ProtectedRoute>
          }
        >
          <Route path="jobs" element={<MyJobPosts />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

const renderAdminShell = () => {
  useAuth.mockReturnValue({ currentUser: ADMIN });
  return renderShell(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        >
          <Route path="users" element={<UserManagement />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('Dashboard shell renders nested routes exactly once', () => {
  beforeEach(() => {
    useAuth.mockReset();
    axiosInstance.get.mockReset();
    mockApi();
  });

  it('worker shell: /worker/performance appears once with the shell intact', async () => {
    renderWorkerShell();

    // The worker dashboard no longer shows a "Worker Dashboard" h2 above the
    // banner (layout refactor), so the shell identity is the navbar — and the
    // title must not appear at all.
    expect(
      screen.queryByRole('heading', { name: 'Worker Dashboard' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);

    // The nested page appears exactly once — the double-<Outlet /> regression.
    expect(screen.getAllByRole('heading', { name: 'My performance' })).toHaveLength(1);
    expect(await screen.findByText('No reviews yet')).toBeInTheDocument();
    expect(screen.getAllByText('No reviews yet')).toHaveLength(1);
  });

  it('worker shell: /worker/notifications appears once (previously crashed blank)', async () => {
    renderWorkerShell('/worker/notifications');

    expect(await screen.findByRole('heading', { name: /^notifications/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^notifications/i })).toHaveLength(1);
    expect(
      await screen.findByRole('heading', { name: /no notifications yet/i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /no notifications yet/i })).toHaveLength(1);
  });

  it('employer shell: /employer/jobs appears once with the shell intact', async () => {
    renderEmployerShell();

    expect(
      await screen.findByRole('heading', { name: 'Employer Dashboard' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Employer Dashboard' })).toHaveLength(1);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);

    // h3 text includes the count ("My job posts · 0"), so match loosely.
    expect(screen.getAllByRole('heading', { name: /my job posts/i })).toHaveLength(1);
    expect(
      await screen.findByRole('heading', { name: /no job posts yet/i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /no job posts yet/i })).toHaveLength(1);
  });

  it('admin shell: /admin/users appears once through the shared layout', async () => {
    renderAdminShell();

    expect(
      await screen.findByRole('heading', { name: 'Admin Dashboard' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Admin Dashboard' })).toHaveLength(1);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);

    expect(await screen.findByRole('heading', { name: /^users/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^users/i })).toHaveLength(1);
  });

  it('parent route shows the overview only — the nested page must not render', async () => {
    renderWorkerShell('/worker');

    // Overview content renders exactly once: the welcome banner (capitalized
    // name), the stat cards, and the new schedule + activity sections.
    expect(
      await screen.findByRole('heading', { name: /welcome back, ana!/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Open jobs available')).toHaveLength(1);
    expect(
      screen.getAllByRole('heading', { name: /today's schedule & active job/i })
    ).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: /recent activity/i })).toHaveLength(1);

    // ...and no child page leaks in.
    expect(
      screen.queryByRole('heading', { name: 'My performance' })
    ).not.toBeInTheDocument();
  });
});
