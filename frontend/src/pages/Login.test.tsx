import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';

// Mock the auth context so tests control the login() call directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

type LoginEntry = string | { pathname: string; state?: unknown };

const renderLogin = (entries: LoginEntry | LoginEntry[] = '/login') =>
  render(
    <MemoryRouter
      initialEntries={Array.isArray(entries) ? entries : [entries]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/worker" element={<div>Worker Home</div>} />
        <Route path="/employer" element={<div>Employer Home</div>} />
        <Route path="/admin" element={<div>Admin Home</div>} />
        <Route path="/worker/jobs" element={<div>Worker Jobs</div>} />
      </Routes>
    </MemoryRouter>
  );

const typeCredentials = async (
  user: UserEvent,
  email = 'worker@example.com',
  password = 'secret123'
) => {
  await user.type(screen.getByLabelText('Email address'), email);
  await user.type(screen.getByLabelText('Password'), password);
};

describe('Login', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ login: vi.fn() });
  });

  it('renders the sign-in form', () => {
    renderLogin();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  describe('validation', () => {
    it('shows inline errors when submitting an empty form', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Email is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
      expect(useAuth().login).not.toHaveBeenCalled();
    });

    it('rejects a malformed email address', async () => {
      const user = userEvent.setup();
      renderLogin();

      await typeCredentials(user, 'not-an-email');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(
        await screen.findByText('Enter a valid email address.')
      ).toBeInTheDocument();
      expect(useAuth().login).not.toHaveBeenCalled();
    });

    it('clears a field error as soon as the user edits that field', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: /sign in/i }));
      expect(await screen.findByText('Email is required.')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Email address'), 'a');
      expect(screen.queryByText('Email is required.')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('disables the button and shows a spinner while the request is in flight', async () => {
      const user = userEvent.setup();
      let resolveLogin: (value: unknown) => void;
      const login = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveLogin = resolve;
          })
      );
      useAuth.mockReturnValue({ login });
      renderLogin();

      await typeCredentials(user);
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      const button = screen.getByRole('button', { name: /signing in/i });
      expect(button).toBeDisabled();
      expect(login).toHaveBeenCalledWith('worker@example.com', 'secret123');

      await act(async () => {
        resolveLogin({ id: 1, name: 'Ana', role: 'WORKER', token: 'jwt' });
      });
      // The resolved session must still land the user on their dashboard.
      expect(await screen.findByText('Worker Home')).toBeInTheDocument();
    });
  });

  describe('redirects', () => {
    it('sends a WORKER to /worker after successful login', async () => {
      const user = userEvent.setup();
      const login = vi
        .fn()
        .mockResolvedValue({ id: 1, name: 'Ana', role: 'WORKER', token: 'jwt' });
      useAuth.mockReturnValue({ login });
      renderLogin();

      await typeCredentials(user);
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Worker Home')).toBeInTheDocument();
    });

    it('sends an ADMIN to /admin after successful login', async () => {
      const user = userEvent.setup();
      const login = vi
        .fn()
        .mockResolvedValue({ id: 2, name: 'Zoe', role: 'ADMIN', token: 'jwt' });
      useAuth.mockReturnValue({ login });
      renderLogin();

      await typeCredentials(user, 'admin@example.com');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Admin Home')).toBeInTheDocument();
    });

    it('prefers the originally requested page over the role home', async () => {
      const user = userEvent.setup();
      const login = vi
        .fn()
        .mockResolvedValue({ id: 3, name: 'Bob', role: 'EMPLOYER', token: 'jwt' });
      useAuth.mockReturnValue({ login });
      renderLogin([
        { pathname: '/login', state: { from: { pathname: '/worker/jobs' } } },
      ]);

      await typeCredentials(user, 'bob@example.com');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Worker Jobs')).toBeInTheDocument();
    });
  });

  describe('password visibility toggle', () => {
    it('reveals and hides the password with the toggle button', async () => {
      const user = userEvent.setup();
      renderLogin();

      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('type', 'password');

      await user.click(screen.getByRole('button', { name: /show password/i }));
      expect(input).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      await user.click(screen.getByRole('button', { name: /hide password/i }));
      expect(input).toHaveAttribute('type', 'password');
      expect(screen.getByRole('button', { name: /show password/i })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });
  });

  describe('forgot password', () => {
    it('switches to the reset form and sends a reset link for the entered email', async () => {
      const forgotPassword = vi.fn().mockResolvedValue({});
      useAuth.mockReturnValue({ login: vi.fn(), forgotPassword });
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: /forgot password/i }));

      expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
      // The sign-in form is replaced, not hidden alongside the reset form.
      expect(screen.queryByRole('button', { name: /^sign in$/i })).not.toBeInTheDocument();

      await user.type(screen.getByLabelText('Email address'), 'ana@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      expect(forgotPassword).toHaveBeenCalledWith('ana@example.com');
      expect(
        await screen.findByText(/password-reset link is on its way/i)
      ).toBeInTheDocument();
    });

    it('shows the generic success message even when the backend rejects the email', async () => {
      // A backend rejection (e.g. unknown account) must not reveal whether an
      // email has an account — the same success message is shown.
      const forgotPassword = vi.fn().mockRejectedValue({
        response: { data: { message: 'No account found' } },
      });
      useAuth.mockReturnValue({ login: vi.fn(), forgotPassword });
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: /forgot password/i }));
      await user.type(screen.getByLabelText('Email address'), 'ghost@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      expect(
        await screen.findByText(/password-reset link is on its way/i)
      ).toBeInTheDocument();
      expect(screen.queryByText('No account found')).not.toBeInTheDocument();
    });

    it('shows a network error when the server is unreachable', async () => {
      const forgotPassword = vi.fn().mockRejectedValue(new Error('Network Error'));
      useAuth.mockReturnValue({ login: vi.fn(), forgotPassword });
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: /forgot password/i }));
      await user.type(screen.getByLabelText('Email address'), 'ana@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      expect(
        await screen.findByText(/Cannot reach the server/i)
      ).toBeInTheDocument();
    });

    it('returns to the sign-in form via “Back to sign in”', async () => {
      useAuth.mockReturnValue({ login: vi.fn(), forgotPassword: vi.fn() });
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: /forgot password/i }));
      expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /back to sign in/i }));

      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.queryByTestId('forgot-password-form')).not.toBeInTheDocument();
    });
  });

  describe('server errors', () => {
    it('shows the backend message on failed login and stays on the page', async () => {
      const user = userEvent.setup();
      const login = vi.fn().mockRejectedValue({
        response: {
          data: { message: 'Invalid email or password.' },
        },
      });
      useAuth.mockReturnValue({ login });
      renderLogin();

      await typeCredentials(user, 'wrong@example.com');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(
        await screen.findByText('Invalid email or password.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });

    it('falls back to a generic message when the backend is unreachable', async () => {
      const user = userEvent.setup();
      const login = vi.fn().mockRejectedValue(new Error('Network Error'));
      useAuth.mockReturnValue({ login });
      renderLogin();

      await typeCredentials(user);
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(
        await screen.findByText('Unable to sign in. Please try again.')
      ).toBeInTheDocument();
    });
  });
});
