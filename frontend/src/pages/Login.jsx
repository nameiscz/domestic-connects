import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { EMAIL_RE } from '../utils/validation';
import { errorMessage } from '../utils/errors';

export default function Login() {
  const { login, forgotPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot-password mode swaps the sign-in form for the email request form.
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

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

  const handleForgotPassword = async (e) => {
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
      if (err?.response) {
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

            {resetMode ? (
              <div data-testid="forgot-password-form">
                {resetSent ? (
                  <>
                    <div className="alert alert-success py-2" role="alert">
                      If an account exists for <strong>{resetEmail}</strong>, a
                      password-reset link is on its way. Check your inbox (and
                      your spam folder).
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-secondary w-100"
                      onClick={backToSignIn}
                    >
                      ← Back to sign in
                    </button>
                  </>
                ) : (
                  <>
                    <h6 className="mb-1">Reset your password</h6>
                    <p className="text-muted small mb-3">
                      Enter your account email and we&apos;ll send you a link to
                      reset your password.
                    </p>

                    {resetError && (
                      <div className="alert alert-danger py-2" role="alert">
                        {resetError}
                      </div>
                    )}

                    <form onSubmit={handleForgotPassword} noValidate>
                      <div className="mb-3">
                        <label htmlFor="reset-email" className="form-label">
                          Email address
                        </label>
                        <input
                          id="reset-email"
                          type="email"
                          className="form-control"
                          placeholder="you@example.com"
                          value={resetEmail}
                          onChange={(e) => {
                            setResetEmail(e.target.value);
                            if (resetError) setResetError('');
                          }}
                          autoComplete="email"
                          autoFocus
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary w-100"
                        disabled={resetSubmitting}
                      >
                        {resetSubmitting ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              aria-hidden="true"
                            />
                            Sending…
                          </>
                        ) : (
                          'Send reset link'
                        )}
                      </button>
                    </form>

                    <button
                      type="button"
                      className="btn btn-link w-100 mt-2 text-decoration-none"
                      onClick={backToSignIn}
                    >
                      ← Back to sign in
                    </button>
                  </>
                )}
              </div>
            ) : (
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
                  autoFocus
                />
                {errors.email && <div className="invalid-feedback">{errors.email}</div>}
              </div>

              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label htmlFor="password" className="form-label mb-0">
                    Password
                  </label>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-decoration-none"
                    onClick={() => {
                      setResetMode(true);
                      setServerError('');
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="input-group">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
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
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    👁️
                  </button>
                </div>
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
            )}
          </div>
        </div>

        <p className="text-center text-muted mt-4 mb-0">
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
