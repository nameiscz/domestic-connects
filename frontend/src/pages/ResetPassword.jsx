import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../utils/errors';

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
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const validate = () => {
    const next = {};
    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }
    if (!confirm) {
      next.confirm = 'Please confirm your password.';
    } else if (confirm !== password) {
      next.confirm = 'Passwords do not match.';
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
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    if (field === 'password') setPassword(value);
    else setConfirm(value);
    // Clear the inline error for a field as soon as the user edits it.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="text-center mb-4">
          <h1 className="h3 fw-bold text-primary mb-1">Domestic Connects</h1>
          <p className="text-muted mb-0">Reset your password</p>
        </div>

        <div className="card shadow-sm">
          <div className="card-body p-4">
            {!token ? (
              <>
                <div className="text-center py-3">
                  <p className="fs-4 mb-1" role="img" aria-hidden="true">
                    🔗
                  </p>
                  <h5 className="card-title">Invalid or expired link</h5>
                  <p className="card-text text-muted mb-4">
                    This password-reset link is missing or has expired. Request
                    a new link from the sign-in page.
                  </p>
                  <Link to="/login" className="btn btn-primary">
                    Go to sign in
                  </Link>
                </div>
              </>
            ) : done ? (
              <>
                <div className="text-center py-3">
                  <p className="fs-4 mb-1" role="img" aria-hidden="true">
                    ✅
                  </p>
                  <h5 className="card-title">Password updated</h5>
                  <p className="card-text text-muted mb-4">
                    Your password has been changed. You can now sign in with
                    your new password.
                  </p>
                  <Link to="/login" className="btn btn-primary">
                    Go to sign in
                  </Link>
                </div>
              </>
            ) : (
              <>
                {serverError && (
                  <div className="alert alert-danger py-2" role="alert">
                    {serverError}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-3">
                    <label htmlFor="new-password" className="form-label">
                      New password
                    </label>
                    <div className="input-group">
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={handleChange('password')}
                        aria-invalid={Boolean(errors.password)}
                        autoComplete="new-password"
                        autoFocus
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
                    {errors.password && (
                      <div className="invalid-feedback">{errors.password}</div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label htmlFor="confirm-password" className="form-label">
                      Confirm new password
                    </label>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      className={`form-control ${errors.confirm ? 'is-invalid' : ''}`}
                      placeholder="Re-enter your new password"
                      value={confirm}
                      onChange={handleChange('confirm')}
                      aria-invalid={Boolean(errors.confirm)}
                      autoComplete="new-password"
                    />
                    {errors.confirm && (
                      <div className="invalid-feedback">{errors.confirm}</div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          aria-hidden="true"
                        />
                        Updating…
                      </>
                    ) : (
                      'Update password'
                    )}
                  </button>
                </form>

                <p className="text-center text-muted mt-4 mb-0">
                  Remembered it? <Link to="/login">Sign in</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
