import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Register from './Register';

// Mock the auth context so tests control the register() call directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

const renderRegister = () =>
  render(
    <MemoryRouter
      initialEntries={['/register']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );

const fillForm = async (user, overrides = {}) => {
  await user.type(screen.getByLabelText('Full name'), overrides.name ?? 'Jane Doe');
  await user.type(
    screen.getByLabelText('Email address'),
    overrides.email ?? 'jane@example.com'
  );
  await user.type(screen.getByLabelText('Password'), overrides.password ?? 'secret123');
};

describe('Register', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ register: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the form with WORKER and EMPLOYER roles only', () => {
    renderRegister();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Worker' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Employer' })).toBeInTheDocument();
    // Admin accounts are never self-signed-up.
    expect(screen.queryByRole('option', { name: 'Admin' })).not.toBeInTheDocument();
  });

  describe('validation', () => {
    it('shows inline errors when submitting an empty form', async () => {
      const user = userEvent.setup();
      renderRegister();

      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
      expect(screen.getByText('Email is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
      expect(useAuth().register).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 6 characters', async () => {
      const user = userEvent.setup();
      renderRegister();

      await fillForm(user, { password: '12345' });
      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(
        await screen.findByText('Password must be at least 6 characters.')
      ).toBeInTheDocument();
      expect(useAuth().register).not.toHaveBeenCalled();
    });

    it('clears a field error as soon as the user edits that field', async () => {
      const user = userEvent.setup();
      renderRegister();

      await user.click(screen.getByRole('button', { name: /create account/i }));
      expect(await screen.findByText('Full name is required.')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Full name'), 'J');
      expect(screen.queryByText('Full name is required.')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('disables the button and shows a spinner while registering', async () => {
      const user = userEvent.setup();
      let resolveRegister;
      const register = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveRegister = resolve;
          })
      );
      useAuth.mockReturnValue({ register });
      renderRegister();

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /create account/i }));

      const button = screen.getByRole('button', { name: /creating account/i });
      expect(button).toBeDisabled();
      expect(register).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret123',
        role: 'WORKER',
      });

      await act(async () => {
        resolveRegister({ id: 1, name: 'Jane Doe', role: 'WORKER' });
      });
      expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
    });
  });

  describe('role selection', () => {
    it('passes the selected EMPLOYER role through to register', async () => {
      const user = userEvent.setup();
      const register = vi.fn().mockResolvedValue({ id: 1, role: 'EMPLOYER' });
      useAuth.mockReturnValue({ register });
      renderRegister();

      await fillForm(user, { name: 'Mark', email: 'mark@example.com' });
      await user.selectOptions(screen.getByLabelText('I am a…'), 'EMPLOYER');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await screen.findByText(/Account created — verify your email/i);
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'EMPLOYER' })
      );
    });
  });

  describe('success flow', () => {
    it('shows a verify-email message with the submitted email', async () => {
      const user = userEvent.setup();
      const register = vi.fn().mockResolvedValue({ id: 1, role: 'WORKER' });
      useAuth.mockReturnValue({ register });
      renderRegister();

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(
        await screen.findByText(/Account created — verify your email/i)
      ).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(register).toHaveBeenCalledTimes(1);
    });

    it('auto-redirects to /login after the countdown', async () => {
      vi.useFakeTimers();
      const register = vi.fn().mockResolvedValue({ id: 1, role: 'WORKER' });
      useAuth.mockReturnValue({ register });
      renderRegister();

      // fireEvent is used here because userEvent relies on timers that are
      // frozen by vi.useFakeTimers().
      fireEvent.change(screen.getByLabelText('Full name'), {
        target: { value: 'Jane Doe' },
      });
      fireEvent.change(screen.getByLabelText('Email address'), {
        target: { value: 'jane@example.com' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'secret123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      // Flush the resolved register() promise so the success alert renders.
      await act(async () => {});
      expect(screen.getByText(/Account created — verify your email/i)).toBeInTheDocument();
      expect(screen.getByText(/in 3s/)).toBeInTheDocument();

      // One second in, the countdown must tick down.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.getByText(/in 2s/)).toBeInTheDocument();

      // Advance past the 3-second redirect (small margin for timer
      // boundary off-by-ones on slow CI machines).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2050);
      });
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  describe('server errors', () => {
    it('shows the backend message and no success alert on failure', async () => {
      const user = userEvent.setup();
      const register = vi.fn().mockRejectedValue({
        response: {
          data: { message: "User with email 'jane@example.com' already exists" },
        },
      });
      useAuth.mockReturnValue({ register });
      renderRegister();

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(
        await screen.findByText("User with email 'jane@example.com' already exists")
      ).toBeInTheDocument();
      expect(screen.queryByText(/Account created/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
    });
  });
});
