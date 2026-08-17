import { Component, type ErrorInfo, type ReactNode } from 'react';
import Logo from './Logo';

/**
 * ErrorBoundary — global render-error guard. Catches errors thrown anywhere
 * below it and shows a friendly, on-brand "Something went wrong" screen with
 * a reload button instead of a white page. Rendered once around <App /> in
 * main.tsx.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log for diagnostics; the UI itself must stay calm and usable.
    console.error('Unhandled UI error caught by ErrorBoundary:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
          <div className="w-full max-w-md text-center">
            <p className="mb-5 inline-flex items-center justify-center">
              <Logo size={48} />
            </p>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              An unexpected error occurred while rendering this page. Your
              account is safe — try reloading, and if the problem persists,
              sign out and back in.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
