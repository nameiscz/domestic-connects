import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/jobFormat';
import { useToasts } from '../../hooks/useToasts';
import ToastStack from '../../components/ToastStack';

// NotificationType → badge variant / friendly label (mirrors the backend enum).
const TYPE_META = {
  JOB_ASSIGNED: { variant: 'success', label: 'Job assigned' },
  SALARY_SLIP_GENERATED: { variant: 'primary', label: 'Salary slip' },
  PERFORMANCE_REVIEWED: { variant: 'warning', label: 'Performance review' },
};

const typeMeta = (type) => TYPE_META[type] || { variant: 'secondary', label: type };

/**
 * Notifications — the logged-in worker's inbox
 * (GET /api/notifications/{userId}, newest first; unread ones can be marked
 * read via PATCH /api/notifications/{id}/read). The backend only permits
 * WORKER callers to access their own inbox.
 */
export default function Notifications() {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const { toasts, pushToast, dismissToast } = useToasts();

  const [notifications, setNotifications] = useState(null); // null = not loaded
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const loadInbox = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosInstance.get(`/api/notifications/${userId}`, {
        signal,
      });
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED') {
        setError(
          err.response?.data?.message || 'Unable to load your notifications.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    loadInbox(controller.signal);
    return () => controller.abort();
  }, [userId, loadInbox, refresh]);

  const unreadCount = (notifications ?? []).filter((n) => !n.isRead).length;

  const handleMarkRead = async (notification) => {
    // Only unread notifications can be marked; one at a time.
    if (notification.isRead || markingId) return;
    setMarkingId(notification.id);
    try {
      await axiosInstance.patch(`/api/notifications/${notification.id}/read`);
      setNotifications((prev) =>
        (prev ?? []).map((n) =>
          n.id === notification.id ? { ...n, isRead: true } : n
        )
      );
    } catch (err) {
      pushToast(
        err.response?.data?.message || 'Unable to mark as read. Please try again.',
        'danger'
      );
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <section aria-busy={loading || Boolean(markingId)}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header: unread count + refresh */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">
          Notifications{' '}
          {!loading && !error && notifications && (
            <span className="text-muted fw-normal">
              · {unreadCount} unread of {notifications.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => setRefresh((r) => r + 1)}
          disabled={loading}
        >
          {loading ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              />
              Refreshing…
            </>
          ) : (
            'Refresh'
          )}
        </button>
      </div>

      {!userId ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">👷</p>
            <h5 className="card-title">Account not recognised</h5>
            <p className="card-text text-muted mb-0">
              We couldn&apos;t identify your account. Please sign in again.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger shadow-sm" role="alert">
          <h4 className="alert-heading h6">Couldn&apos;t load your notifications</h4>
          <p className="mb-2">{error}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => setRefresh((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : notifications === null ? (
        /* In-flight fetch, or the initial fetch was aborted (e.g. by React
           StrictMode's dev remount) — keep showing the loading state rather
           than touching notifications.length on a null value. */
        <div className="text-center py-5" data-testid="notifications-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading notifications…</span>
          </div>
          <p className="text-muted mt-3 mb-0">Fetching your inbox…</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <p className="fs-4 mb-1">🔔</p>
            <h5 className="card-title">No notifications yet</h5>
            <p className="card-text text-muted mb-0">
              Job assignments, salary slips and performance reviews will show up here.
            </p>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <ul className="list-group list-group-flush">
            {notifications.map((notification) => {
              const meta = typeMeta(notification.type);
              const unread = !notification.isRead;
              return (
                <li
                  key={notification.id}
                  className={`list-group-item d-flex align-items-start gap-3 ${
                    unread ? 'bg-primary bg-opacity-10' : ''
                  }`}
                >
                  {unread && (
                    <span
                      className="badge rounded-pill bg-primary mt-2 flex-shrink-0"
                      aria-label="Unread"
                      title="Unread"
                    >
                      ●
                    </span>
                  )}
                  <div className="flex-grow-1">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span className={`badge badge-soft-${meta.variant}`}>
                        {meta.label}
                      </span>
                      <span className="text-muted small">
                        {formatDate(notification.createdAt)}
                      </span>
                    </div>
                    <p className={`mb-0 mt-1${unread ? ' fw-semibold' : ''}`}>
                      {notification.message}
                    </p>
                  </div>
                  {unread && (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm flex-shrink-0"
                      onClick={() => handleMarkRead(notification)}
                      disabled={Boolean(markingId)}
                      data-testid={`mark-read-${notification.id}`}
                    >
                      {markingId === notification.id ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-1"
                            aria-hidden="true"
                          />
                          Saving…
                        </>
                      ) : (
                        'Mark as read'
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
