import { useEffect, useRef } from 'react';

/**
 * CSS-only Bootstrap modal shell (Bootstrap JS is not bundled, so visibility
 * is driven by the parent mounting this component plus the `show d-block`
 * classes). The parent must render it conditionally and pass an `onClose`
 * that unmounts it.
 *
 * - Closes on Escape and on clicks on the dimmed backdrop.
 * - Locks background scroll while open and restores it on close.
 * - Focuses the element marked `data-autofocus` on open (fallback: the
 *   dialog itself), and returns focus to the previously focused element
 *   when the modal closes.
 *
 * Usage:
 *   {isOpen && (
 *     <Modal onClose={close} labelledBy="my-modal-title">
 *       <div className="modal-content">
 *         <div className="modal-header">
 *           <h5 className="modal-title" id="my-modal-title">Title</h5>
 *           …
 *         </div>
 *         …
 *       </div>
 *     </Modal>
 *   )}
 */
export default function Modal({ onClose = () => {}, labelledBy, children }) {
  const shellRef = useRef(null);
  // Keep the latest onClose without re-running the mount effect.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // Trap Tab so focus cannot leave the dialog (WAI-ARIA dialog pattern).
      if (e.key !== 'Tab') return;
      const focusables = shellRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Focus the marked element (or the dialog) once layout settles.
    const focusTarget =
      shellRef.current?.querySelector('[data-autofocus]') ?? shellRef.current;
    focusTarget?.focus?.();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousActive?.focus?.();
    };
  }, []);

  return (
    <>
      <div
        ref={shellRef}
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(e) => {
          // Close when the click lands on the shell (outside the dialog).
          if (e.target === e.currentTarget) onCloseRef.current();
        }}
      >
        <div className="modal-dialog modal-dialog-centered">{children}</div>
      </div>
      <div className="modal-backdrop fade show" aria-hidden="true" />
    </>
  );
}
