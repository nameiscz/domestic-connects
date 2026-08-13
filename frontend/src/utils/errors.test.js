import { describe, it, expect } from 'vitest';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('returns the backend message verbatim when present', () => {
    expect(
      errorMessage({ response: { data: { message: "User with email 'j@x.com' already exists" } } })
    ).toBe("User with email 'j@x.com' already exists");
  });

  it('falls back to the HTTP status when the server responds without a message', () => {
    expect(errorMessage({ response: { status: 503 } })).toBe(
      'Request failed (HTTP 503). Please try again.'
    );
  });

  it('says the server cannot be reached on network failures (no response)', () => {
    // axios network errors have no `response` (connection refused, CORS, timeout).
    expect(errorMessage(new Error('Network Error'))).toBe(
      'Cannot reach the server. Please check that the backend is running and try again.'
    );
  });

  it('handles missing/undefined errors gracefully', () => {
    expect(errorMessage(undefined)).toBe(
      'Cannot reach the server. Please check that the backend is running and try again.'
    );
  });
});
