/**
 * Fixed top-right Bootstrap toast stack (accessible live region).
 *
 * Renders nothing when `toasts` is empty. Toasts come from the page's
 * useToasts() hook; dismiss uses the hook's `dismissToast`.
 *
 * Usage:
 *   const { toasts, pushToast, dismissToast } = useToasts();
 *   <ToastStack toasts={toasts} onDismiss={dismissToast} />
 */
export default function ToastStack({ toasts, onDismiss = () => {} }) {
  if (toasts.length === 0) return null;

  return (
    <>
      <div
        className="toast-container position-fixed top-0 end-0 p-3"
        style={{ zIndex: 1080 }}
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`toast align-items-center border-0 show toast-enter text-bg-${
              toast.variant === 'danger' ? 'danger' : 'success'
            }`}
          >
            <div className="d-flex">
              <div className="toast-body">{toast.message}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label="Dismiss notification"
                onClick={() => onDismiss(toast.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
