import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { AuthShell, Button, Input } from '../components/ui';
import { EMAIL_RE } from '../utils/validation';
import { errorMessage } from '../utils/errors';
import type { LoginPayload } from '../types';

type LoginErrors = Partial<Record<keyof LoginPayload, string>>;

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

export default function Login() {
  const { login, forgotPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState<LoginPayload>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot-password mode swaps the sign-in form for the email request form.
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Where the user was heading before being bounced to login (if any).
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return 'Email is required.';
    if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
    return undefined;
  };

  const validate = (): LoginErrors => {
    const next: LoginErrors = {};
    const emailError = validateEmail(form.email);
    if (emailError) next.email = emailError;
    if (!form.password) next.password = 'Password is required.';
    return next;
  };

  const clearFieldError = (field: keyof LoginErrors) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const user = await login(form.email.trim(), form.password);
      const target = from || ROLE_HOME[user.role] || '/';
      navigate(target, { replace: true });
    } catch (err) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setServerError(
        axiosErr?.response?.data?.message || 'Unable to sign in. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetError('');
    if (!EMAIL_RE.test(resetEmail.trim())) {
      setResetError('Enter a valid email address.');
      return;
    }

    setResetSubmitting(true);
    try {
      await forgotPassword(resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      if ((err as { response?: unknown })?.response) {
        // Backend-level rejection (e.g. unknown email) — still show the
        // generic success message so the form can't be used to probe which
        // emails have accounts.
        setResetSent(true);
      } else {
        setResetError(errorMessage(err));
      }
    } finally {
      setResetSubmitting(false);
    }
  };

  const backToSignIn = () => {
    setResetMode(false);
    setResetEmail('');
    setResetError('');
    setResetSent(false);
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your account"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-teal-700 hover:text-teal-900">
            Create one
          </Link>
        </>
      }
    >
      {serverError && <ErrorBanner message={serverError} />}

      {resetMode ? (
        <div data-testid="forgot-password-form">
          {resetSent ? (
            <div className="animate-fade-in">
              <div
                role="status"
                className="mb-5 rounded-xl border border-success/20 border-l-4 border-l-success bg-success-soft px-4 py-3 text-sm text-success-text"
              >
                If an account exists for <strong>{resetEmail}</strong>, a
                password-reset link is on its way. Check your inbox (and your
                spam folder).
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={backToSignIn}
              >
                ← Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <KeyRound size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold leading-tight text-ink">
                    Reset your password
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Enter your account email and we&apos;ll send you a link to
                    reset your password.
                  </p>
                </div>
              </div>

              {resetError && <ErrorBanner message={resetError} />}

              <form onSubmit={handleForgotPassword} noValidate>
                <Input
                  id="reset-email"
                  type="email"
                  label="Email address"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    if (resetError) setResetError('');
                  }}
                  autoComplete="email"
                  autoFocus
                  className="mb-4"
                />
                <Button type="submit" className="w-full" isLoading={resetSubmitting}>
                  {resetSubmitting ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>

              <button
                type="button"
                className="mt-3 w-full text-center text-sm font-medium text-teal-700 transition-colors hover:text-teal-900"
                onClick={backToSignIn}
              >
                ← Back to sign in
              </button>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => {
              setForm((f) => ({ ...f, email: e.target.value }));
              clearFieldError('email');
            }}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value) {
                const err = validateEmail(value);
                if (err) setErrors((prev) => ({ ...prev, email: err }));
              }
            }}
            error={errors.email}
            autoComplete="email"
            autoFocus
            className="mb-4"
          />

          <div className="mb-6">
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-semibold text-ink">
                Password
              </label>
              <button
                type="button"
                className="group -mr-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium text-ink-soft transition-colors hover:bg-teal-100/70 hover:text-teal-700"
                onClick={() => {
                  setResetMode(true);
                  setServerError('');
                }}
              >
                <KeyRound size={13} className="text-teal-700/70 transition-colors group-hover:text-teal-700" aria-hidden="true" />
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={[
                  'w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm text-ink',
                  'placeholder:text-ink-soft/60',
                  'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25',
                  errors.password ? 'border-danger' : 'border-line hover:border-ink-soft/40',
                ].join(' ')}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => {
                  setForm((f) => ({ ...f, password: e.target.value }));
                  clearFieldError('password');
                }}
                aria-invalid={errors.password ? true : undefined}
                autoComplete="current-password"
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

          <Button type="submit" className="w-full" isLoading={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
