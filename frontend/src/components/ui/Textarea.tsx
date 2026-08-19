import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

/**
 * Textarea — multiline sibling of Input, same API and a11y wiring.
 */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  id?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helperText, error, id, className = '', rows = 4, ...rest },
  ref
) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const describedBy =
    [helperText ? `${textareaId}-help` : '', error ? `${textareaId}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="mb-1.5 block text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'w-full resize-y rounded-xl border bg-card px-3.5 py-2.5 text-sm text-ink',
          'placeholder:text-ink-soft/60',
          'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25',
          error ? 'border-danger' : 'border-line hover:border-ink-soft/40',
          className,
        ].join(' ')}
        {...rest}
      />
      {helperText && !error && (
        <p id={`${textareaId}-help`} className="mt-1.5 text-xs text-ink-soft">
          {helperText}
        </p>
      )}
      {error && (
        <p id={`${textareaId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
});

export default Textarea;
