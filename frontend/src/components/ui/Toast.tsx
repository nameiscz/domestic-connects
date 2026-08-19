import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Toast system for the premium UI.
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
  success: 'border-l-[3px] border-l-emerald-500',
  error: 'border-l-[3px] border-l-red-500',
  info: 'border-l-[3px] border-l-[#155E63]',
};

const VARIANT_ICON_BG: Record<ToastVariant, string> = {
  success: 'bg-emerald-50 text-emerald-600',
  error: 'bg-red-50 text-red-500',
  info: 'bg-teal-50 text-[#155E63]',
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
      className="pointer-events-none fixed right-4 top-4 z-[1080] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={[
            'pointer-events-auto flex items-start gap-3 rounded-2xl bg-card p-4',
            'shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]',
            'animate-toast-in',
            VARIANT_ACCENT[toast.variant],
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${VARIANT_ICON_BG[toast.variant]}`}
          >
            {VARIANT_ICON[toast.variant]}
          </span>
          <p className="flex-1 text-sm font-medium text-ink">{toast.message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            className="-m-1 flex h-7 w-7 flex-none items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-black/[0.05] hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastStack;
