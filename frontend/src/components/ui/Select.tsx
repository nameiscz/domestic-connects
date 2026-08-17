import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

/**
 * Select — labeled native select with helper text and an error state,
 * mirroring Input's API and a11y wiring.
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
          'w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink',
          'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%234B5A54%22%20stroke-width%3D%222%22%20fill%3D%22none%22%2F%3E%3C%2Fsvg%3E")] bg-[right_0.9rem_center] bg-no-repeat pr-9',
          'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25',
          error ? 'border-danger' : 'border-line hover:border-ink-soft/40',
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
        <p id={`${selectId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
});

export default Select;
