import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Notifications from './Notifications';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const CURRENT_USER = { id: 11, name: 'Ana', role: 'WORKER' };

const INBOX = [
  {
    id: 401,
    userId: 11,
    message: 'You have been assigned to the job "Household Helper".',
    type: 'JOB_ASSIGNED',
    isRead: false,
    createdAt: '2026-08-10T09:00:00',
  },
  {
    id: 402,
    userId: 11,
    message: 'Your salary slip for 8/2026 is ready to download.',
    type: 'SALARY_SLIP_GENERATED',
    isRead: true,
    createdAt: '2026-08-09T10:00:00',
  },
];

const renderPage = () => {
  useAuth.mockReturnValue({ currentUser: CURRENT_USER });
  return render(<Notifications />);
};

describe('Notifications', () => {
  beforeEach(() => {
    useAuth.mockReset();
    axiosInstance.get.mockReset();
    axiosInstance.patch.mockReset();
  });

  it('loads the inbox and renders the unread count', async () => {
    axiosInstance.get.mockResolvedValue({ data: INBOX });
    renderPage();

    expect(
      await screen.findByText('· 1 unread of 2')
    ).toBeInTheDocument();
    expect(
      screen.getByText('You have been assigned to the job "Household Helper".')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your salary slip for 8/2026 is ready to download.')
    ).toBeInTheDocument();
  });

  it('marks an unread notification as read via PATCH and updates the row', async () => {
    axiosInstance.get.mockResolvedValue({ data: INBOX });
    axiosInstance.patch.mockResolvedValue({ data: INBOX[0] });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/· 1 unread of 2/i);

    await user.click(screen.getByTestId('mark-read-401'));

    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/notifications/401/read');
    expect(await screen.findByText('· 0 unread of 2')).toBeInTheDocument();
    expect(screen.queryByTestId('mark-read-401')).not.toBeInTheDocument();
  });

  it('surfaces a toast when marking as read fails', async () => {
    axiosInstance.get.mockResolvedValue({ data: INBOX });
    axiosInstance.patch.mockRejectedValue({
      response: { data: { message: 'Notification service unavailable' } },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/· 1 unread of 2/i);
    await user.click(screen.getByTestId('mark-read-401'));

    expect(
      await screen.findByText('Notification service unavailable')
    ).toBeInTheDocument();
  });

  it('shows an empty state when the inbox is empty', async () => {
    axiosInstance.get.mockResolvedValue({ data: [] });
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /no notifications yet/i })
    ).toBeInTheDocument();
  });

  it('shows an error with retry when the inbox fails to load', async () => {
    let calls = 0;
    axiosInstance.get.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({ response: { data: { message: 'Service unavailable' } } });
      }
      return Promise.resolve({ data: INBOX });
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /couldn't load your notifications/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('· 1 unread of 2')).toBeInTheDocument();
  });

  it('explains when the account id is missing', () => {
    useAuth.mockReturnValue({ currentUser: null });
    render(<Notifications />);
    expect(screen.getByText(/account not recognised/i)).toBeInTheDocument();
  });
});
