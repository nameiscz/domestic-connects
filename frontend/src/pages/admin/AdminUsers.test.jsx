import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminUsers from './AdminUsers';

// Mock the axios instance so tests control every fetch directly.
const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const USERS = [
  { id: 1, name: 'Ana', email: 'ana@example.com', role: 'WORKER', verified: true, active: true },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'EMPLOYER', verified: true, active: false },
  { id: 3, name: 'Unverified', email: 'unv@example.com', role: 'WORKER', verified: false, active: true },
];

const renderPage = () => render(<AdminUsers />);

describe('AdminUsers', () => {
  beforeEach(() => {
    axiosInstance.get.mockReset();
    axiosInstance.patch.mockReset();
    axiosInstance.get.mockResolvedValue({ data: { data: USERS } });
  });

  it('renders the user table with role and status badges', async () => {
    renderPage();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    // Two WORKER rows (Ana + the unverified account) vs one EMPLOYER row.
    expect(screen.getAllByText('WORKER')).toHaveLength(2);
    expect(screen.getByText('EMPLOYER')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });

  it('deactivates an active user via PATCH and updates the row', async () => {
    axiosInstance.patch.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ana');
    await user.click(screen.getByTestId('toggle-1'));

    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/auth/admin/users/1/deactivate');
    // Ana joins Bob as deactivated (two badges now), and her action flips to
    // "Activate".
    await waitFor(() => expect(screen.getAllByText('Deactivated')).toHaveLength(2));
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
});
