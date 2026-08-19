import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell, Button, PasswordInput } from '../components/ui';
import { errorMessage } from '../utils/errors';
import { passwordError } from '../utils/validation';

type ResetField = 'password' | 'confirm';

type ResetErrors = Partial<Record<ResetField, string>>;

/** A friendly, specific server-error banner (never a raw HTTP dump). */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-xl border border-red-200 border-l-4 border-l-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
    >
      {message}
    </div>
  );
}

/**
 * ResetPassword — sets a new password using the one-time token from the
 * emailed reset link (/reset-password?token=…).
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
          <Link to="/login" className="font-semibold text-[#155E63] hover:text-teal-700 transition-colors">
            Sign in
          </Link>
        </>
      }
    >
      {!token ? (
        <div className="animate-fade-in py-2 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <KeyRound size={26} aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-ink">
            Invalid or expired link
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-ink-soft">
            This password-reset link is missing or has expired. Request a new
            link from the sign-in page.
          </p>
          <Link to="/login" className="mt-5 inline-block w-full">
            <Button variant="secondary" className="w-full">
              Go to sign in
            </Button>
          </Link>
        </div>
      ) : done ? (
        <div className="animate-fade-in py-2 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={26} aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-ink">Password updated</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-ink-soft">
            Your password has been changed. You can now sign in with your new
            password.
          </p>
          <Link to="/login" className="mt-5 inline-block w-full">
            <Button className="w-full h-12 rounded-2xl text-[15px]">Go to sign in</Button>
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
              <PasswordInput
                id="new-password"
                placeholder="8–10 characters with A–Z, a–z, 0–9, special"
                value={password}
                onChange={handleChange('password')}
                error={errors.password}
                autoComplete="new-password"
                autoFocus
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            </div>

            <div className="mb-6">
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-ink">
                Confirm new password
              </label>
              <PasswordInput
                id="confirm-password"
                placeholder="Re-enter your new password"
                value={confirm}
                onChange={handleChange('confirm')}
                error={errors.confirm}
                autoComplete="new-password"
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            </div>

            <Button type="submit" className="w-full h-12 rounded-2xl text-[15px]" isLoading={submitting}>
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
