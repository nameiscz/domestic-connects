import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Logo from './Logo';

describe('Logo', () => {
  it('renders the tile mark as decorative SVG at the requested size', () => {
    const { container } = render(<Logo size={30} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true'); // decorative next to the wordmark
    expect(svg).toHaveAttribute('width', '30');
    expect(svg.querySelector('rect')).toHaveAttribute('fill', expect.stringContaining('url(#'));
  });

  it('renders the dot variant for navbar scale', () => {
    const { container } = render(<Logo variant="dot" size={9} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg.querySelector('circle')).toHaveAttribute('fill', '#f2a93b');
  });

  it('keeps gradient ids unique across multiple instances', () => {
    const { container } = render(
      <>
        <Logo size={24} />
        <Logo size={24} />
      </>
    );

    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
