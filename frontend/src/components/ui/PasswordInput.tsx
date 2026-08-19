import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * PasswordInput — labeled password field with a built-in eye-toggle button
 * inside the input. Supports both internal state (default) and external
 * `visible`/`onToggle` control for synchronized multi-field toggling.
 */

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
  id?: string;
  /** External visibility control — when provided, overrides internal state. */
  visible?: boolean;
  /** Callback when the eye icon is clicked. Required when `visible` is controlled externally. */
  onToggle?: () => void;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, helperText, error, id, className = '', visible: externalVisible, onToggle, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [internalVisible, setInternalVisible] = useState(false);

    // Use external state if provided, otherwise fall back to internal state.
    const visible = externalVisible !== undefined ? externalVisible : internalVisible;
    const toggle = onToggle || (() => setInternalVisible((v) => !v));

    const describedBy =
      [helperText ? `${inputId}-help` : '', error ? `${inputId}-error` : '']
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={[
              'w-full rounded-[14px] border bg-white px-4 py-3.5 pr-12 text-[15px] text-ink',
              'placeholder:text-ink-soft/50',
              'transition-all duration-200',
              'focus:border-teal-500 focus:outline-none focus:ring-[3px] focus:ring-teal-500/15 focus:shadow-[0_0_0_3px_rgba(21,94,99,0.1)]',
              error
                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                : 'border-black/[0.08] hover:border-black/[0.15]',
              className,
            ].join(' ')}
            {...rest}
          />
          <button
            type="button"
            onClick={toggle}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className={[
              'absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center',
              'rounded-lg text-ink-soft/50',
              'transition-colors duration-200 hover:text-ink',
            ].join(' ')}
          >
            <span key={visible ? 'on' : 'off'} className="inline-flex eye-toggle-enter">
              {visible ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
            </span>
          </button>
        </div>
        {helperText && !error && (
          <p id={`${inputId}-help`} className="mt-1.5 text-xs text-ink-soft">
            {helperText}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-500">
            {error}
          </p>
        )}
      </div>
    );
  }
);

export default PasswordInput;
