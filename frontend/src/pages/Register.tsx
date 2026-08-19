import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { AuthShell, Button, Input, PasswordInput, Select } from '../components/ui';
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
      className="mb-5 rounded-xl border border-red-200 border-l-4 border-l-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
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
          <Link to="/login" className="font-semibold text-[#155E63] hover:text-teal-700 transition-colors">
            Sign in
          </Link>
        </>
      }
    >
      {serverError && <ErrorBanner message={serverError} />}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
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
          />
        </div>

        <div className="mb-4">
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
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="8–10 characters with A–Z, a–z, 0–9, special"
            value={form.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={errors.password}
            autoComplete="new-password"
          />
          <PasswordChecklist value={form.password} />
        </div>

        <div className="mb-6">
          <Select
            id="role"
            name="role"
            label="I am a…"
            value={form.role}
            onChange={(e) => handleChange('role', e.target.value)}
            error={errors.role}
          >
            {REGISTRATION_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit" className="w-full h-12 rounded-2xl text-[15px]" isLoading={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
