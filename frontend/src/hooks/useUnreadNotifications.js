import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';

const POLL_INTERVAL_MS = 30_000;

/**
 * useUnreadNotifications — unread-count state for the navbar bell badge.
 *
 * Fetches the worker's notification inbox (GET /api/notifications/{userId},
 * the gateway path for /notification-service/notifications/{userId}) and
 * counts the unread items. It refetches when the route changes (navigation
 * usually follows an action that produced a notification) and every 30s while
 * mounted — deliberately no websockets for this project.
 *
 * Failures are swallowed: the badge is decorative, so a hiccup should never
 * break the UI. Pass a falsy userId (non-worker roles) to disable the hook.
 */
export default function useUnreadNotifications(userId) {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const { data } = await axiosInstance.get(`/api/notifications/${userId}`);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      setUnreadCount(list.filter((n) => !n.isRead).length);
    } catch {
      // Best-effort only — keep the last known count on failure.
    }
  }, [userId]);

  // Refetch immediately on mount and whenever the route changes.
  useEffect(() => {
    refresh();
  }, [refresh, location.pathname]);

  // Then keep polling every 30s for as long as the navbar is mounted.
  useEffect(() => {
    if (!userId) return undefined;
    const intervalId = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [refresh, userId]);

  return unreadCount;
}
