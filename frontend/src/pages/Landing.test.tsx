import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

const renderPage = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );

describe('Landing', () => {
  it('renders the hero and wired CTA links', () => {
    renderPage();

    // Exactly one h1 — the hero headline.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');

    // Every "Post a job" CTA (header, hero, final section) points at /register.
    const postJobLinks = screen.getAllByRole('link', { name: 'Post a job' });
    expect(postJobLinks.length).toBeGreaterThanOrEqual(2);
    postJobLinks.forEach((link) => expect(link).toHaveAttribute('href', '/register'));

    const findWorkLinks = screen.getAllByRole('link', { name: 'Find work near you' });
    expect(findWorkLinks.length).toBeGreaterThanOrEqual(2);
    findWorkLinks.forEach((link) => expect(link).toHaveAttribute('href', '/register'));
  });

  it('reveals sections when IntersectionObserver is unavailable (jsdom)', () => {
    renderPage();

    // The scroll-reveal effect falls back to showing everything immediately,
    // so no section stays hidden and the page never crashes without IO.
    expect(document.querySelectorAll('.landing .reveal.visible').length).toBeGreaterThan(0);
  });
});
