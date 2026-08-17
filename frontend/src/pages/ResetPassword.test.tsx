import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResetPassword from './ResetPassword';

// Mock the auth context so tests control resetPassword() directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth }));

const renderPage = (token = 'reset-token-123') =>
  render(
    <MemoryRouter
      initialEntries={[`/reset-password${token ? `?token=${token}` : ''}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );

const fillPasswords = async (user: UserEvent, password = 'Newsec1!') => {
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm new password'), password);
};

describe('ResetPassword', () => {
  beforeEach(() => {
    useAuth.mockReset();
    useAuth.mockReturnValue({ resetPassword: vi.fn() });
  });

  it('shows an invalid-link state when the token is missing', () => {
    renderPage('');

    expect(
      screen.getByRole('heading', { name: /invalid or expired link/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('resets the password via the token from the URL', async () => {
    const resetPassword = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({ resetPassword });
    const user = userEvent.setup();
    renderPage();

    await fillPasswords(user);

    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(resetPassword).toHaveBeenCalledWith('reset-token-123', 'Newsec1!');
    expect(
      await screen.findByRole('heading', { name: /password updated/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('toggles both password fields between hidden and visible', async () => {
    const user = userEvent.setup();
    renderPage();

    const newPassword = screen.getByLabelText('New password');
    const confirm = screen.getByLabelText('Confirm new password');
    expect(newPassword).toHaveAttribute('type', 'password');
    expect(confirm).toHaveAttribute('type', 'password');

    // Each field has its own eye toggle; either one reveals both fields.
    const showButtons = screen.getAllByRole('button', { name: /show password/i });
    expect(showButtons).toHaveLength(2);
    await user.click(showButtons[0]);
    expect(newPassword).toHaveAttribute('type', 'text');
    expect(confirm).toHaveAttribute('type', 'text');

    const hideButtons = screen.getAllByRole('button', { name: /hide password/i });
    expect(hideButtons).toHaveLength(2);
    await user.click(hideButtons[1]);
    expect(newPassword).toHaveAttribute('type', 'password');
    expect(confirm).toHaveAttribute('type', 'password');
  });

  it('shows inline errors for a short or mismatched password', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('New password'), '12345');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(
      await screen.findByText('Password must be 8–10 characters long.')
    ).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(useAuth().resetPassword).not.toHaveBeenCalled();
  });

  it('rejects a password longer than 10 characters', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillPasswords(user, 'Newsecret12!');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(
      await screen.findByText('Password must be 8–10 characters long.')
    ).toBeInTheDocument();
    expect(useAuth().resetPassword).not.toHaveBeenCalled();
  });

  it('rejects a password missing uppercase, number, or special characters', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillPasswords(user, 'newsecret1');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(
      await screen.findByText(
        'Password must include uppercase, lowercase, a number, and a special character.'
      )
    ).toBeInTheDocument();
    expect(useAuth().resetPassword).not.toHaveBeenCalled();
  });

  it('shows the backend message when the reset fails', async () => {
    const resetPassword = vi.fn().mockRejectedValue({
      response: { data: { message: 'Token expired or invalid' } },
    });
    useAuth.mockReturnValue({ resetPassword });
    const user = userEvent.setup();
    renderPage();

    await fillPasswords(user);
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText('Token expired or invalid')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /password updated/i })).not.toBeInTheDocument();
  });

  it('links back to the sign-in page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login'
    );
  });
});
