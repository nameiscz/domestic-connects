import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Toast system for the migrated UI.
 *
 *   const { toasts, pushToast, dismissToast } = useToast();
 *   pushToast('Saved!', 'success');
 *   <ToastStack toasts={toasts} onDismiss={dismissToast} />
 *
 * Toasts auto-dismiss after 4.5s and stack in a fixed top-right live region.
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const AUTO_DISMISS_MS = 4500;

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: 'border-l-teal-500',
  error: 'border-l-danger',
  info: 'border-l-teal-700',
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastId = useRef(0);
  const timersRef = useRef<number[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = ++nextToastId.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      const timer = window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
      timersRef.current.push(timer);
    },
    [dismissToast]
  );

  // Clear pending auto-dismiss timers when the consuming component unmounts.
  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    },
    []
  );

  return { toasts, pushToast, dismissToast };
}

export interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[1080] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={[
            'pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-white p-3.5 shadow-card',
            'animate-toast-in border-l-4',
            VARIANT_ACCENT[toast.variant],
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700"
          >
            {VARIANT_ICON[toast.variant]}
          </span>
          <p className="flex-1 text-sm text-ink">{toast.message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            className="-m-1 flex h-6 w-6 flex-none items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-line/60 hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastStack;
