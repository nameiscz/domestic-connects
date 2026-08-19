import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { AuthShell, Button, Input, PasswordInput } from '../components/ui';
import { EMAIL_RE } from '../utils/validation';
import { errorMessage } from '../utils/errors';
import type { LoginPayload } from '../types';

type LoginErrors = Partial<Record<keyof LoginPayload, string>>;

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

export default function Login() {
  const { login, forgotPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState<LoginPayload>({ email: '', password: '' });
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
          <Link to="/register" className="font-semibold text-[#155E63] hover:text-teal-700 transition-colors">
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
                className="mb-5 rounded-xl border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
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
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-teal-50 text-[#155E63]">
                  <KeyRound size={20} strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold leading-tight text-ink">
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
                  className="mb-5"
                />
                <Button type="submit" className="w-full h-12 rounded-2xl text-[15px]" isLoading={resetSubmitting}>
                  {resetSubmitting ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>

              <button
                type="button"
                className="mt-4 w-full text-center text-sm font-medium text-[#155E63] transition-colors hover:text-teal-700 hover:underline"
                onClick={backToSignIn}
              >
                ← Back to sign in
              </button>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
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
            />
          </div>

          <div className="mb-5">
            <PasswordInput
              id="password"
              label="Password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => {
                setForm((f) => ({ ...f, password: e.target.value }));
                clearFieldError('password');
              }}
              error={errors.password}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="mt-2 block text-[13px] font-medium text-[#155E63] transition-colors hover:text-teal-700 hover:underline"
              onClick={() => {
                setResetMode(true);
                setServerError('');
              }}
            >
              Forgot password?
            </button>
          </div>

          <Button type="submit" className="w-full h-12 rounded-2xl text-[15px]" isLoading={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
