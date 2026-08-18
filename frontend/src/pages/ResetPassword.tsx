import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell, Button } from '../components/ui';
import { errorMessage } from '../utils/errors';
import { passwordError } from '../utils/validation';

type ResetField = 'password' | 'confirm';

type ResetErrors = Partial<Record<ResetField, string>>;

/** A friendly, specific server-error banner (never a raw HTTP dump). */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-xl border border-danger/20 border-l-4 border-l-danger bg-danger-soft px-4 py-3 text-sm font-medium text-danger-text"
    >
      {message}
    </div>
  );
}

/**
 * ResetPassword — sets a new password using the one-time token from the
 * emailed reset link (/reset-password?token=…).
 *
 * Submits the token + new password to the auth-service
 * (POST /api/auth/reset-password, gateway path /api/auth/reset-password).
 * A missing or invalid token renders an "invalid or expired link" state
 * instead of the form, so a stale email link never dead-ends.
 */
export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ResetErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const validate = (): ResetErrors => {
    const next: ResetErrors = {};
    const passwordErr = passwordError(password);
    if (passwordErr) next.password = passwordErr;
    if (!confirm) {
      next.confirm = 'Please confirm your password.';
    } else if (confirm !== password) {
      next.confirm = 'Passwords do not match.';
    }
    return next;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange =
    (field: ResetField) => (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (field === 'password') setPassword(value);
      else setConfirm(value);
      // Clear the inline error for a field as soon as the user edits it.
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Choose a new password for your account"
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-900">
            Sign in
          </Link>
        </>
      }
    >
      {!token ? (
        <div className="animate-fade-in py-2 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-marigold-100 text-marigold-600">
            <KeyRound size={26} aria-hidden="true" />
          </span>
          <h2 className="font-display text-lg font-semibold text-ink">
            Invalid or expired link
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-ink-soft">
            This password-reset link is missing or has expired. Request a new
            link from the sign-in page.
          </p>
          <Link to="/login" className="mt-5 inline-block">
            <Button variant="secondary" className="w-full">
              Go to sign in
            </Button>
          </Link>
        </div>
      ) : done ? (
        <div className="animate-fade-in py-2 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success-text">
            <CheckCircle2 size={26} aria-hidden="true" />
          </span>
          <h2 className="font-display text-lg font-semibold text-ink">Password updated</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-ink-soft">
            Your password has been changed. You can now sign in with your new
            password.
          </p>
          <Link to="/login" className="mt-5 inline-block">
            <Button className="w-full">Go to sign in</Button>
          </Link>
        </div>
      ) : (
        <div data-testid="reset-password-form">
          {serverError && <ErrorBanner message={serverError} />}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-ink">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className={[
                    'w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm text-ink',
                    'placeholder:text-ink-soft/60',
                    'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25',
                    errors.password ? 'border-danger' : 'border-line hover:border-ink-soft/40',
                  ].join(' ')}
                  placeholder="8–10 characters with A–Z, a–z, 0–9, special"
                  value={password}
                  onChange={handleChange('password')}
                  aria-invalid={Boolean(errors.password)}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-line/60 hover:text-ink"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-danger-text">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-ink">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className={[
                    'w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm text-ink',
                    'placeholder:text-ink-soft/60',
                    'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25',
                    errors.confirm ? 'border-danger' : 'border-line hover:border-ink-soft/40',
                  ].join(' ')}
                  placeholder="Re-enter your new password"
                  value={confirm}
                  onChange={handleChange('confirm')}
                  aria-invalid={Boolean(errors.confirm)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-line/60 hover:text-ink"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.confirm && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-danger-text">
                  {errors.confirm}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" isLoading={submitting}>
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
