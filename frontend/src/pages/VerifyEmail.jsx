import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';

/**
 * VerifyEmail — public page reached from the verification link in the email
 * (https://…/verify?token=…) or manually (paste the code). Calls
 * POST /api/auth/verify/{token} (whitelisted at the gateway, no login needed),
 * then points the user to /login.
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';

  const [token, setToken] = useState(urlToken);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null); // null | { ok, message }
  const [didAutoVerify, setDidAutoVerify] = useState(false);

  const verify = async (value) => {
    const trimmed = (value ?? token).trim();
    if (!trimmed || verifying) return;
    setVerifying(true);
    setResult(null);
    try {
      const { data } = await axiosInstance.post(`/api/auth/verify/${trimmed}`);
      setResult({ ok: true, message: data?.message || 'Email verified successfully.' });
    } catch (err) {
      setResult({
        ok: false,
        message:
          err.response?.data?.message ||
          'We couldn’t verify that code. It may be invalid or expired.',
      });
    } finally {
      setVerifying(false);
    }
  };

  // Auto-verify when the link carries a token.
  useEffect(() => {
    if (urlToken && !didAutoVerify) {
      setDidAutoVerify(true);
      verify(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="text-center mb-4">
          <h1 className="h3 fw-bold text-primary mb-1">Domestic Connects</h1>
          <p className="text-muted mb-0">Verify your email</p>
        </div>

        <div className="card shadow-sm">
          <div className="card-body p-4">
            {verifying ? (
              <div className="text-center py-4" data-testid="verify-verifying">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Verifying…</span>
                </div>
                <p className="text-muted mt-3 mb-0">Verifying your email…</p>
              </div>
            ) : result ? (
              <div
                className={`alert ${result.ok ? 'alert-success' : 'alert-danger'} mb-0`}
                role="status"
              >
                <h5 className="alert-heading">
                  {result.ok ? 'Email verified!' : 'Verification failed'}
                </h5>
                <p className="mb-2">{result.message}</p>
                {result.ok ? (
                  <Link to="/login" className="btn btn-primary btn-sm">
                    Go to sign in
                  </Link>
                ) : (
                  <div className="mt-3">
                    <label htmlFor="verify-token" className="form-label">
                      Paste the code from your email
                    </label>
                    <input
                      id="verify-token"
                      className="form-control mb-2"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="e.g. a1b2c3d4-e5f6-…"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => verify()}
                      disabled={!token.trim()}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verify();
                }}
              >
                <p className="text-muted mb-3">
                  Enter the verification code from the email we sent you.
                </p>
                <div className="mb-3">
                  <label htmlFor="verify-token" className="form-label">
                    Verification code
                  </label>
                  <input
                    id="verify-token"
                    className="form-control"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="e.g. a1b2c3d4-e5f6-…"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={!token.trim()}
                >
                  Verify email
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-muted mt-4 mb-0">
          Already verified? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
