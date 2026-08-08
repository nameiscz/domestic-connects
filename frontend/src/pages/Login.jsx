import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { EMAIL_RE } from '../utils/validation';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Where the user was heading before being bounced to login (if any).
  const from = location.state?.from?.pathname;

  const validate = () => {
    const next = {};
    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!EMAIL_RE.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (!password) {
      next.password = 'Password is required.';
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
      const user = await login(email.trim(), password);
      const target = from || ROLE_HOME[user.role] || '/';
      navigate(target, { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.message || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="text-center mb-4">
          <h1 className="h3 fw-bold text-primary mb-1">Domestic Connects</h1>
          <p className="text-muted mb-0">Sign in to your account</p>
        </div>

        <div className="card shadow-sm">
          <div className="card-body p-4">
            {serverError && (
              <div className="alert alert-danger py-2" role="alert">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                />
                {errors.email && <div className="invalid-feedback">{errors.email}</div>}
              </div>

              <div className="mb-4">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  aria-invalid={Boolean(errors.password)}
                  autoComplete="current-password"
                />
                {errors.password && <div className="invalid-feedback">{errors.password}</div>}
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                {submitting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-muted mt-4 mb-0">
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
