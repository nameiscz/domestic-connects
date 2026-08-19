import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

/**
 * Select — premium native select matching the Input component's design.
 * 56px height, 14px radius, subtle neutral border, teal focus ring.
 */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  id?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helperText, error, id, className = '', children, ...rest },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const describedBy =
    [helperText ? `${selectId}-help` : '', error ? `${selectId}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'w-full appearance-none rounded-[14px] border bg-card px-4 py-3.5 text-[15px] text-ink',
          'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%234B5A54%22%20stroke-width%3D%222%22%20fill%3D%22none%22%2F%3E%3C%2Fsvg%3E")] bg-[right_1rem_center] bg-no-repeat pr-10',
          'transition-all duration-200',
          'focus:border-teal-500 focus:outline-none focus:ring-[3px] focus:ring-teal-500/15 focus:shadow-[0_0_0_3px_rgba(21,94,99,0.1)]',
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-black/[0.08] hover:border-black/[0.15] dark:border-white/[0.08] dark:hover:border-white/[0.15]',
          className,
        ].join(' ')}
        {...rest}
      >
        {children}
      </select>
      {helperText && !error && (
        <p id={`${selectId}-help`} className="mt-1.5 text-xs text-ink-soft">
          {helperText}
        </p>
      )}
      {error && (
        <p id={`${selectId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});

export default Select;
