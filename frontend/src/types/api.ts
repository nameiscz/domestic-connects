/**
 * Shared API envelope + error types.
 *
 * The backend wraps most responses in `ApiResponse<T>` ({success, message,
 * data}); errors carry a `message` plus optional status/timestamp. Axios
 * failures are normalized via `toApiError` so UI code always sees an
 * `ApiError` instead of raw axios error objects.
 */

/** Backend `ApiResponse<T>` envelope. */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Normalized error shape used across the typed API layer and UI. */
export interface ApiError {
  message: string;
  status?: number;
  timestamp?: string;
}

/**
 * Normalizes an unknown axios/network failure into an ApiError, mirroring the
 * existing utils/errors.js priority: backend `message` → HTTP status → generic
 * "cannot reach server".
 */
export function toApiError(err: unknown): ApiError {
  const e = err as { response?: { data?: { message?: unknown }; status?: unknown }; message?: unknown };
  const backendMessage = e?.response?.data?.message;
  if (typeof backendMessage === 'string' && backendMessage) {
    return { message: backendMessage, status: asNumber(e?.response?.status) };
  }
  if (e?.response) {
    return {
      message: `Request failed (HTTP ${asNumber(e?.response?.status) ?? '?'}). Please try again.`,
      status: asNumber(e?.response?.status),
    };
  }
  return {
    message:
      'Cannot reach the server. Please check that the backend is running and try again.',
  };
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/** Generic pagination envelope (the plan's PaginatedResponse<T>). */
export interface PaginatedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  currentPage: number;
}
