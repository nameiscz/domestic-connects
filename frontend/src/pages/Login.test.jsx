import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';

// Mock the auth context so tests control the login() call directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

const renderLogin = (entries = '/login') =>
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

const typeCredentials = async (user, email = 'worker@example.com', password = 'secret123') => {
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
      let resolveLogin;
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

  describe('server errors', () => {
    it('shows the backend message on failed login and stays on the page', async () => {
      const user = userEvent.setup();
      const login = vi.fn().mockRejectedValue({
        response: {
          data: { message: 'Please verify your email before logging in.' },
        },
      });
      useAuth.mockReturnValue({ login });
      renderLogin();

      await typeCredentials(user, 'unverified@example.com');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(
        await screen.findByText('Please verify your email before logging in.')
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
