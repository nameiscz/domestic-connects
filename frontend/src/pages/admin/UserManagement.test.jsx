import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserManagement from './UserManagement';

// Mock the axios instance so tests control every fetch directly.
const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const USERS = [
  { id: 1, name: 'Ana', email: 'ana@example.com', role: 'WORKER', active: true },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'EMPLOYER', active: false },
  { id: 3, name: 'Carlos', email: 'carlos@example.com', role: 'WORKER', active: true },
];

// More than one page (default page size is 10).
const MANY_USERS = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 3 === 0 ? 'ADMIN' : 'WORKER',
  active: i % 2 === 0,
}));

const renderPage = () => render(<UserManagement />);

describe('UserManagement', () => {
  beforeEach(() => {
    axiosInstance.get.mockReset();
    axiosInstance.patch.mockReset();
    axiosInstance.get.mockResolvedValue({ data: { data: USERS } });
  });

  it('renders the user table with role and status badges', async () => {
    renderPage();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    // Two WORKER rows (Ana + Carlos) vs one EMPLOYER row.
    expect(screen.getAllByText('WORKER')).toHaveLength(2);
    expect(screen.getByText('EMPLOYER')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('deactivates an active user via PATCH and updates the row', async () => {
    axiosInstance.patch.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ana');
    await user.click(screen.getByTestId('toggle-1'));

    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/auth/admin/users/1/deactivate');
    // Ana joins Bob as inactive (two badges now), and her action flips to
    // "Activate".
    await waitFor(() => expect(screen.getAllByText('Inactive')).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: /^activate/i })).toHaveLength(2);
  });

  it('reactivates a deactivated user via PATCH', async () => {
    axiosInstance.patch.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Bob');
    await user.click(screen.getByTestId('toggle-2'));

    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/auth/admin/users/2/activate');
  });

  it('shows a toast when the toggle fails', async () => {
    axiosInstance.patch.mockRejectedValue({
      response: { data: { message: 'Auth service unavailable' } },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ana');
    await user.click(screen.getByTestId('toggle-1'));

    expect(await screen.findByText('Auth service unavailable')).toBeInTheDocument();
  });

  it('shows an error with retry when the list fails to load', async () => {
    let calls = 0;
    axiosInstance.get.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({ response: { data: { message: 'Admin service unavailable' } } });
      }
      return Promise.resolve({ data: { data: USERS } });
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Admin service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Ana')).toBeInTheDocument();
  });

  it('shows an empty state when no users exist', async () => {
    axiosInstance.get.mockResolvedValue({ data: { data: [] } });
    renderPage();

    expect(await screen.findByRole('heading', { name: /no users yet/i })).toBeInTheDocument();
  });

  it('filters the table as the admin types a search', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ana');
    await user.type(screen.getByRole('searchbox'), 'bob');

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument();
  });

  it('shows a no-matches message when the search finds nothing', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ana');
    await user.type(screen.getByRole('searchbox'), 'zzz');

    expect(
      screen.getByRole('heading', { name: /no matching users/i })
    ).toBeInTheDocument();
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('paginates the table and lets the admin flip pages', async () => {
    axiosInstance.get.mockResolvedValue({ data: { data: MANY_USERS } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('User 10');
    // Page 1 shows the first 10 of 12 rows.
    expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument();
    expect(screen.getByText('User 10')).toBeInTheDocument();
    expect(screen.queryByText('User 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText('User 11')).toBeInTheDocument();
    expect(screen.getByText('User 12')).toBeInTheDocument();
    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /previous page/i }));
    expect(screen.getByText('User 10')).toBeInTheDocument();
    expect(screen.queryByText('User 11')).not.toBeInTheDocument();
  });
});
