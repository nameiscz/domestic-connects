import { useId } from 'react';

/**
 * Domestic Connects logo mark (teal rounded tile + marigold dot — same art as
 * /favicon.svg and /logo.svg).
 *
 * - variant="tile" (default): the full mark, for auth pages and any larger
 *   brand moment.
 * - variant="dot": just the marigold dot, sized for the navbar/landing
 *   headers where a full tile would be too heavy.
 *
 * The SVG is aria-hidden: it's decorative next to the "Domestic Connects"
 * wordmark, so screen readers get the text.
 */
export default function Logo({ size = 28, variant = 'tile', className = '' }) {
  // Unique gradient ids so multiple Logo instances never collide.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tileId = `dc-logo-tile-${uid}`;
  const dotId = `dc-logo-dot-${uid}`;

  if (variant === 'dot') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        className={className}
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="8" cy="8" r="8" fill="#f2a93b" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={tileId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14555a" />
          <stop offset="1" stopColor="#0a3b3f" />
        </linearGradient>
        <radialGradient id={dotId} cx="0.35" cy="0.3" r="1">
          <stop offset="0" stopColor="#ffc05e" />
          <stop offset="1" stopColor="#f2a93b" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${tileId})`} />
      <circle cx="32" cy="32" r="15" fill={`url(#${dotId})`} />
    </svg>
  );
}
