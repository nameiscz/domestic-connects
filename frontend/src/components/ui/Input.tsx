import { forwardRef, useId, type InputHTMLAttributes } from 'react';

/**
 * Input — premium SaaS-style labeled text input.
 *
 * Design: 56px height, 14px radius, 1px subtle neutral border, soft teal
 * focus ring. Matches Linear / Notion / Stripe Dashboard quality.
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
          'w-full rounded-[14px] border bg-card px-4 py-3.5 text-[15px] text-ink',
          'placeholder:text-ink-soft/50',
          'transition-all duration-200',
          'focus:border-teal-500 focus:outline-none focus:ring-[3px] focus:ring-teal-500/15 focus:shadow-[0_0_0_3px_rgba(21,94,99,0.1)]',
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-black/[0.08] hover:border-black/[0.15] dark:border-white/[0.08] dark:hover:border-white/[0.15]',
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
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
