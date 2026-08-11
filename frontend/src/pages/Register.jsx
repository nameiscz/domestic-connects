import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EMAIL_RE } from '../utils/validation';

// Registration is only open to workers and employers — admin accounts are
// provisioned by existing admins, never self-signed-up.
const REGISTRATION_ROLES = [
  { value: 'WORKER', label: 'Worker' },
  { value: 'EMPLOYER', label: 'Employer' },
];

const REDIRECT_DELAY_SECONDS = 3;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'WORKER' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [countdown, setCountdown] = useState(null);

  // After a successful registration show the verify-email message, then
  // automatically send the user to /login. (countdown is set together with
  // `registered` in handleSubmit so there is no "null" flash on first render.)
  useEffect(() => {
    if (!registered) return undefined;

    const interval = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1000
    );
    const timeout = setTimeout(
      () => navigate('/login', { replace: true }),
      REDIRECT_DELAY_SECONDS * 1000
    );

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [registered, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear the inline error for a field as soon as the user edits it.
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
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
    if (!form.password) {
      next.password = 'Password is required.';
    } else if (form.password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }
    if (!form.role) {
      next.role = 'Please choose a role.';
    }
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setCountdown(REDIRECT_DELAY_SECONDS);
      setRegistered(true);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="text-center mb-4">
          <h1 className="h3 fw-bold text-primary mb-1">Domestic Connects</h1>
          <p className="text-muted mb-0">Create your account</p>
        </div>

        <div className="card shadow-sm">
          <div className="card-body p-4">
            {registered ? (
              <div
                className="alert alert-success mb-0"
                role="status"
                aria-live="polite"
              >
                <h5 className="alert-heading">Account created — verify your email</h5>
                <p className="mb-1">
                  We&apos;ve sent a verification link to{' '}
                  <strong>{form.email}</strong>. Check your inbox and click the
                  link to activate your account before signing in.
                </p>
                <p className="mb-2 small text-muted">
                  Redirecting to the sign-in page
                  {countdown > 0 ? ` in ${countdown}s` : ''}…
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <Link to="/login" className="btn btn-outline-primary btn-sm">
                    Go to sign in
                  </Link>
                  <Link to="/verify" className="btn btn-link btn-sm text-decoration-none">
                    Didn&apos;t get the email? Verify manually
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {serverError && (
                  <div className="alert alert-danger py-2" role="alert">
                    {serverError}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">
                      Full name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                      placeholder="Jane Doe"
                      value={form.name}
                      onChange={handleChange}
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={handleChange}
                      aria-invalid={Boolean(errors.email)}
                      autoComplete="email"
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                      placeholder="At least 6 characters"
                      value={form.password}
                      onChange={handleChange}
                      aria-invalid={Boolean(errors.password)}
                      autoComplete="new-password"
                    />
                    {errors.password && (
                      <div className="invalid-feedback">{errors.password}</div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label htmlFor="role" className="form-label">
                      I am a…
                    </label>
                    <select
                      id="role"
                      name="role"
                      className={`form-select ${errors.role ? 'is-invalid' : ''}`}
                      value={form.role}
                      onChange={handleChange}
                      aria-invalid={Boolean(errors.role)}
                    >
                      {REGISTRATION_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {errors.role && <div className="invalid-feedback">{errors.role}</div>}
                  </div>

                  <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                    {submitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          aria-hidden="true"
                        />
                        Creating account…
                      </>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-muted mt-4 mb-0">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
