/**
 * Maps an axios error to a human-readable message.
 *
 * Priority:
 *   1. The backend's own error message (`err.response.data.message`) — shown
 *      verbatim so validation and business errors stay specific (e.g. "Email
 *      already exists").
 *   2. The HTTP status when the server responded but returned no message
 *      (e.g. a gateway error page).
 *   3. A network-level failure — no response at all (backend unreachable,
 *      CORS blocked, timeout). Surfaced as "Cannot reach the server" instead
 *      of a misleading generic "something failed" message.
 */
export function errorMessage(err) {
  const backendMessage = err?.response?.data?.message;
  if (backendMessage) return backendMessage;
  if (err?.response) {
    return `Request failed (HTTP ${err.response.status}). Please try again.`;
  }
  return 'Cannot reach the server. Please check that the backend is running and try again.';
}
