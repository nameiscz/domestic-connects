import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lightweight toast state with auto-dismiss.
 *
 * Returns `{ toasts, pushToast, dismissToast }` — pair `toasts`/`dismissToast`
 * with the <ToastStack /> component and call `pushToast(message, variant)`
 * from anywhere in the page (variant: 'success' | 'danger').
 *
 * Pending auto-dismiss timers are cleared when the consuming page unmounts.
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextToastId = useRef(0);
  const timersRef = useRef([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message, variant = 'success') => {
      const id = ++nextToastId.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      // Auto-dismiss after 4.5s; manual close works via the ✕ button.
      const timer = window.setTimeout(() => dismissToast(id), 4500);
      timersRef.current.push(timer);
    },
    [dismissToast]
  );

  // Clear any pending auto-dismiss timers when the page unmounts.
  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    },
    []
  );

  return { toasts, pushToast, dismissToast };
}
