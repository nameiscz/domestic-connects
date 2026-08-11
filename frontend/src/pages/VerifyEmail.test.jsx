import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerifyEmail from './VerifyEmail';

// Mock the axios instance so tests control the verify call directly.
const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../api/axiosInstance', () => ({ default: axiosInstance }));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <VerifyEmail />
    </MemoryRouter>
  );

describe('VerifyEmail', () => {
  beforeEach(() => {
    axiosInstance.post.mockReset();
  });

  it('auto-verifies when the URL carries a token', async () => {
    axiosInstance.post.mockResolvedValue({
      data: { success: true, message: 'Email verified successfully' },
    });
    renderAt('/verify?token=magic-token');

    expect(
      await screen.findByRole('heading', { name: /email verified!/i })
    ).toBeInTheDocument();
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/auth/verify/magic-token');
  });

  it('shows the failure message and lets the user retry with a pasted code', async () => {
    axiosInstance.post
      .mockRejectedValueOnce({
        response: { data: { message: 'Verification token not found' } },
      })
      .mockResolvedValueOnce({
        data: { success: true, message: 'Email verified successfully' },
      });
    const user = userEvent.setup();
    renderAt('/verify?token=bad-token');

    expect(
      await screen.findByRole('heading', { name: /verification failed/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Verification token not found')).toBeInTheDocument();

    // Paste a fresh code and retry.
    await user.clear(screen.getByLabelText(/paste the code/i));
    await user.type(screen.getByLabelText(/paste the code/i), 'good-token');
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Email verified!')).toBeInTheDocument();
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/auth/verify/good-token');
  });

  it('verifies a manually entered code from the form', async () => {
    axiosInstance.post.mockResolvedValue({
      data: { success: true, message: 'Email verified successfully' },
    });
    const user = userEvent.setup();
    renderAt('/verify');

    await user.type(screen.getByLabelText(/verification code/i), 'typed-token');
    await user.click(screen.getByRole('button', { name: /verify email/i }));

    expect(await screen.findByText('Email verified!')).toBeInTheDocument();
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/auth/verify/typed-token');
  });

  it('disables the manual submit until a token is entered', async () => {
    renderAt('/verify');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /verify email/i })).toBeDisabled();
    });
  });
});
