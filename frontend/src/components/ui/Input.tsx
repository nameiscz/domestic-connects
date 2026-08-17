import { forwardRef, useId, type InputHTMLAttributes } from 'react';

/**
 * Input — labeled text input with optional helper text and a validated error
 * state (red border + message, aria-invalid + aria-describedby wiring).
 */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  id?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, id, className = '', ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
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
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink',
          'placeholder:text-ink-soft/60',
          'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25',
          error ? 'border-danger' : 'border-line hover:border-ink-soft/40',
          className,
        ].join(' ')}
        {...rest}
      />
      {helperText && !error && (
        <p id={`${inputId}-help`} className="mt-1.5 text-xs text-ink-soft">
          {helperText}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
