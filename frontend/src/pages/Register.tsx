import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { AuthShell, Button, Input, Select } from '../components/ui';
import PasswordChecklist from '../components/PasswordChecklist';
import { errorMessage } from '../utils/errors';
import { EMAIL_RE, passwordError } from '../utils/validation';
import type { RegisterPayload, Role } from '../types';

type RegisterErrors = Partial<Record<keyof RegisterPayload, string>>;

// Registration is only open to workers and employers — admin accounts are
// provisioned by existing admins, never self-signed-up.
const REGISTRATION_ROLES: { value: Role; label: string }[] = [
  { value: 'WORKER', label: 'Worker' },
  { value: 'EMPLOYER', label: 'Employer' },
];

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

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterPayload>({
    name: '',
    email: '',
    password: '',
    role: 'WORKER',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof RegisterPayload, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    // Clear the inline error for a field as soon as the user edits it.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): RegisterErrors => {
    const next: RegisterErrors = {};
    if (!form.name.trim()) {
      next.name = 'Full name is required.';
    } else if (form.name.trim().length < 2) {
      next.name = 'Name must be at least 2 characters.';
    }
    if (!form.email.trim()) {
      next.email = 'Email is required.';
    } else if (!EMAIL_RE.test(form.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    const passwordErr = passwordError(form.password);
    if (passwordErr) next.password = passwordErr;
    if (!form.role) {
      next.role = 'Please choose a role.';
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      // Registration returns an authenticated session right away (no email
      // verification), so the user is taken straight to their dashboard.
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      navigate(ROLE_HOME[user.role] || '/', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      wide
      title="Create your account"
      subtitle="Join the households and workers already on Domestic Connects."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-900">
            Sign in
          </Link>
        </>
      }
    >
      {serverError && <ErrorBanner message={serverError} />}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          id="name"
          name="name"
          type="text"
          label="Full name"
          placeholder="Jane Doe"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value && value.length < 2) {
              setErrors((prev) => ({ ...prev, name: 'Name must be at least 2 characters.' }));
            }
          }}
          error={errors.name}
          autoComplete="name"
          autoFocus
          className="mb-4"
        />

        <Input
          id="email"
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value && !EMAIL_RE.test(value)) {
              setErrors((prev) => ({ ...prev, email: 'Enter a valid email address.' }));
            }
          }}
          error={errors.email}
          autoComplete="email"
          className="mb-4"
        />

        <div className="mb-4">
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className={[
                'w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm text-ink',
                'placeholder:text-ink-soft/60',
                'focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25',
                errors.password ? 'border-danger' : 'border-line hover:border-ink-soft/40',
              ].join(' ')}
              placeholder="8–10 characters with A–Z, a–z, 0–9, special"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={(e) => {
                if (e.target.value) {
                  const err = passwordError(e.target.value);
                  if (err) setErrors((prev) => ({ ...prev, password: err }));
                }
              }}
              aria-invalid={errors.password ? true : undefined}
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
          {errors.password && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-text">
              {errors.password}
            </p>
          )}
          <PasswordChecklist value={form.password} />
        </div>

        <Select
          id="role"
          name="role"
          label="I am a…"
          value={form.role}
          onChange={(e) => handleChange('role', e.target.value)}
          error={errors.role}
          className="mb-6"
        >
          {REGISTRATION_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>

        <Button type="submit" className="w-full" isLoading={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
