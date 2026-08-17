import { forwardRef, type ButtonHTMLAttributes } from 'react';

/**
 * Button — the single button primitive for the migrated UI.
 *
 * Variants: primary (teal solid), secondary (white with border), ghost (text).
 * `isLoading` swaps in a spinner, disables the button and sets aria-busy so
 * async actions can't be double-submitted.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-500 active:bg-teal-900',
  secondary:
    'border border-line bg-white text-ink hover:border-teal-500 hover:text-teal-700 active:bg-teal-100/50',
  ghost: 'bg-transparent text-teal-700 hover:bg-teal-100 active:bg-teal-100',
  danger: 'bg-danger text-white hover:bg-danger/90 active:bg-danger-text',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading = false, className = '', disabled, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
