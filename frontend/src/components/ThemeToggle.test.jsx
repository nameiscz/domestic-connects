import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-bs-theme');
    localStorage.clear();
  });

  it('defaults to light and switches to dark on click (persisting the choice)', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    // jsdom has no matchMedia and nothing stored → light.
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');

    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }));

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('dc_theme')).toBe('dark');
    // The button now offers the way back.
    expect(
      screen.getByRole('button', { name: /switch to light theme/i })
    ).toBeInTheDocument();
  });

  it('respects a stored dark preference on mount', () => {
    localStorage.setItem('dc_theme', 'dark');
    render(<ThemeToggle />);

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });
});
