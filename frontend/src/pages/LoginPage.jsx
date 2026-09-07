import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getApiErrorMessage } from '../utils/authResponse';

function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [code, setCode] = useState('');
  const [pendingToken, setPendingToken] = useState(null);
  const [error, setError] = useState('');
  
  const { isAuthenticated, isAuthLoading, login, verify2fa } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const destination = location.state?.from?.pathname || '/dashboard';

  if (isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const response = await login(formData);
      if (response && response.requires_2fa) {
        setPendingToken(response.temp_token);
      } else {
        navigate(destination, { replace: true });
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to log in. Please try again.'));
    }
  };
  
  const handle2FASubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await verify2fa({ temp_token: pendingToken, code });
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Invalid 2FA code. Please try again.'));
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-aside">
        <div>
          <p className="eyebrow eyebrow--light"><span /> Welcome back</p>
          <h1>Good help is only a few clicks away.</h1>
          <p>Sign in to manage your bookings, services, and account.</p>
        </div>
        <blockquote>“The small repairs should be the easiest part of your day.”</blockquote>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <p className="auth-kicker">Account access</p>
          <h2>{pendingToken ? 'Two-Factor Authentication' : 'Log in to FixSquad'}</h2>
          <p className="auth-intro">
            {pendingToken 
              ? 'Enter the 6-digit code from your authenticator app.' 
              : 'Enter the details you used when creating your account.'}
          </p>

          {error && <div className="form-alert" role="alert">{error}</div>}

          {!pendingToken ? (
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <label htmlFor="email">Email address</label>
              <input
                autoComplete="email"
                id="email"
                name="email"
                onChange={handleChange}
                placeholder="you@example.com"
                required
                type="email"
                value={formData.email}
              />

              <div className="label-row">
                <label htmlFor="password">Password</label>
              </div>
              <input
                autoComplete="current-password"
                id="password"
                minLength="6"
                name="password"
                onChange={handleChange}
                placeholder="Enter your password"
                required
                type="password"
                value={formData.password}
              />

              <button className="button button--primary button--wide" disabled={isAuthLoading} type="submit">
                {isAuthLoading ? 'Logging in…' : 'Log in'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handle2FASubmit}>
              <label htmlFor="code">6-Digit Code</label>
              <input
                autoComplete="one-time-code"
                id="code"
                name="code"
                onChange={(e) => { setCode(e.target.value); setError(''); }}
                placeholder="123456"
                required
                type="text"
                maxLength="6"
                pattern="\d{6}"
                value={code}
                style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.2rem' }}
              />

              <button className="button button--primary button--wide" disabled={isAuthLoading} type="submit">
                {isAuthLoading ? 'Verifying…' : 'Verify Code'}
              </button>
              
              <button 
                className="button button--secondary button--wide" 
                style={{ marginTop: '10px' }}
                onClick={() => setPendingToken(null)} 
                type="button"
              >
                Cancel
              </button>
            </form>
          )}

          {!pendingToken && (
            <p className="auth-switch">New to FixSquad? <Link to="/register">Create an account</Link></p>
          )}
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
