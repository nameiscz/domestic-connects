import { forwardRef, type ButtonHTMLAttributes } from 'react';

/**
 * Button — premium SaaS-style button primitive.
 *
 * Design: 16px radius for primary (auth), deep teal (#155E63) background,
 * soft shadow, lift on hover, smooth 200ms transitions.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: [
    'btn-shimmer relative overflow-hidden bg-[#155E63] text-white',
    'shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(21,94,99,0.25)]',
    'hover:bg-[#134f53] hover:shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_20px_rgba(21,94,99,0.3)]',
    'hover:-translate-y-[1px]',
    'active:bg-[#0f4246] active:translate-y-0',
  ].join(' '),
  secondary: [
    'border border-black/[0.08] bg-card text-ink dark:border-white/[0.08]',
    'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
    'hover:border-teal-500/40 hover:text-teal-700 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
    'active:bg-teal-50',
  ].join(' '),
  ghost: 'bg-transparent text-teal-700 hover:bg-teal-50 active:bg-teal-100',
  danger: [
    'btn-shimmer relative overflow-hidden bg-red-500 text-white',
    'shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(239,68,68,0.25)]',
    'hover:bg-red-600 hover:shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_20px_rgba(239,68,68,0.3)]',
    'hover:-translate-y-[1px]',
    'active:bg-red-700 active:translate-y-0',
  ].join(' '),
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-sm rounded-xl',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'h-14 px-6 text-[15px] rounded-2xl font-semibold',
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
        'inline-flex items-center justify-center gap-2.5 font-semibold',
        'transition-all duration-200 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none',
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
