import type { Config } from 'tailwindcss';

/**
 * Domestic Connects design system — the single source of truth for the
 * Tailwind palette and typefaces. Every color below is a named token; UI code
 * must reference these names (teal-700, marigold-500, …), never raw hex.
 *
 * NOTE: `preflight: false` keeps Tailwind's reset off while the remaining
 * Bootstrap pages coexist during the incremental migration. Re-enable
 * preflight (and delete the Bootstrap import in main.tsx) once every page is
 * converted — see the final-pass section of the migration plan.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      /* Every token maps to a design-system CSS variable (--dc-* / --bs-* in
       * index.css), so the exact same utilities flip automatically when the
       * app switches to dark mode ([data-bs-theme='dark']). The hex value is
       * kept as a fallback so the tokens still resolve if the vars are ever
       * missing.
       *
       * Opacity modifiers (e.g. bg-teal-900/90) work with these variable
       * colors because each value uses Tailwind's color-mix() pattern: the
       * <alpha-value> placeholder becomes the modifier, so the utility
       * compiles to `color-mix(in srgb, var(--…) X%, transparent)`. This is
       * required — plain `var(--…)` colors silently lose their `/opacity`
       * utilities on Tailwind 3.4. */
      colors: {
        teal: {
          950: 'color-mix(in srgb, var(--dc-teal-950, #05282C) calc(<alpha-value> * 100%), transparent)',
          900: 'color-mix(in srgb, var(--dc-teal-900, #0A3B3F) calc(<alpha-value> * 100%), transparent)',
          800: 'color-mix(in srgb, var(--dc-teal-800, #0D484D) calc(<alpha-value> * 100%), transparent)',
          700: 'color-mix(in srgb, var(--dc-teal-700, #0F5257) calc(<alpha-value> * 100%), transparent)',
          600: 'color-mix(in srgb, var(--dc-teal-600, #14666C) calc(<alpha-value> * 100%), transparent)',
          500: 'color-mix(in srgb, var(--dc-teal-500, #1B7A80) calc(<alpha-value> * 100%), transparent)',
          400: 'color-mix(in srgb, var(--dc-teal-400, #2F9AA1) calc(<alpha-value> * 100%), transparent)',
          300: 'color-mix(in srgb, var(--dc-teal-300, #7BBBC0) calc(<alpha-value> * 100%), transparent)',
          200: 'color-mix(in srgb, var(--dc-teal-200, #B7D6D4) calc(<alpha-value> * 100%), transparent)',
          100: 'color-mix(in srgb, var(--dc-teal-100, #DCEAE8) calc(<alpha-value> * 100%), transparent)',
          50: 'color-mix(in srgb, var(--dc-teal-50, #F0F6F5) calc(<alpha-value> * 100%), transparent)',
        },
        marigold: {
          700: 'color-mix(in srgb, var(--dc-marigold-700, #B87616) calc(<alpha-value> * 100%), transparent)',
          600: 'color-mix(in srgb, var(--dc-marigold-600, #D98F1F) calc(<alpha-value> * 100%), transparent)',
          500: 'color-mix(in srgb, var(--dc-marigold-500, #F2A93B) calc(<alpha-value> * 100%), transparent)',
          400: 'color-mix(in srgb, var(--dc-marigold-400, #F5BC5F) calc(<alpha-value> * 100%), transparent)',
          300: 'color-mix(in srgb, var(--dc-marigold-300, #FAD593) calc(<alpha-value> * 100%), transparent)',
          100: 'color-mix(in srgb, var(--dc-marigold-100, #FDECC8) calc(<alpha-value> * 100%), transparent)',
          50: 'color-mix(in srgb, var(--dc-marigold-50, #FEF6E4) calc(<alpha-value> * 100%), transparent)',
        },
        canvas: 'color-mix(in srgb, var(--dc-bg, #F5F6F2) calc(<alpha-value> * 100%), transparent)',
        ink: {
          DEFAULT: 'color-mix(in srgb, var(--dc-ink, #14231F) calc(<alpha-value> * 100%), transparent)',
          soft: 'color-mix(in srgb, var(--dc-ink-soft, #51605A) calc(<alpha-value> * 100%), transparent)',
          mute: 'color-mix(in srgb, var(--dc-ink-mute, #7C8B84) calc(<alpha-value> * 100%), transparent)',
        },
        line: 'color-mix(in srgb, var(--dc-border, #DEE3DA) calc(<alpha-value> * 100%), transparent)',
        'line-soft': 'color-mix(in srgb, var(--dc-border-soft, #EAEEE7) calc(<alpha-value> * 100%), transparent)',
        /* Semantic states — soft/text map to Bootstrap's emphasis tokens
         * (which the dark theme block re-maps), DEFAULT to the base color. */
        success: {
          DEFAULT: 'color-mix(in srgb, var(--bs-success, #2F7A55) calc(<alpha-value> * 100%), transparent)',
          soft: 'color-mix(in srgb, var(--bs-success-bg-subtle, #E1EFE7) calc(<alpha-value> * 100%), transparent)',
          text: 'color-mix(in srgb, var(--bs-success-text-emphasis, #1F5C3E) calc(<alpha-value> * 100%), transparent)',
        },
        danger: {
          DEFAULT: 'color-mix(in srgb, var(--bs-danger, #C4453C) calc(<alpha-value> * 100%), transparent)',
          soft: 'color-mix(in srgb, var(--bs-danger-bg-subtle, #FBE4E2) calc(<alpha-value> * 100%), transparent)',
          text: 'color-mix(in srgb, var(--bs-danger-text-emphasis, #8F2F28) calc(<alpha-value> * 100%), transparent)',
        },
      },
      fontFamily: {
        display: ["'Fraunces'", 'Georgia', 'serif'],
        sans: ["'Plus Jakarta Sans'", 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--dc-shadow-card, 0 1px 2px rgba(16, 24, 23, 0.04), 0 8px 24px rgba(16, 24, 23, 0.05))',
        'card-hover': 'var(--dc-shadow-hover, 0 2px 4px rgba(16, 24, 23, 0.05), 0 16px 40px rgba(16, 24, 23, 0.10))',
        lift: 'var(--dc-shadow-lift, 0 4px 8px rgba(10, 59, 63, 0.08), 0 12px 32px rgba(10, 59, 63, 0.16))',
        glow: 'var(--dc-shadow-glow, 0 8px 20px rgba(15, 82, 87, 0.28))',
        'glow-marigold': 'var(--dc-shadow-glow, 0 8px 20px rgba(217, 143, 31, 0.30))',
        panel: 'var(--dc-shadow-card, 0 1px 2px rgba(16, 24, 23, 0.04), 0 4px 12px rgba(16, 24, 23, 0.06))',
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.5rem',
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateX(1rem)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-in': 'toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
