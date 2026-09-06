import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getApiErrorMessage } from '../utils/authResponse';

function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const { isAuthenticated, isAuthLoading, login } = useAuth();
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await login(formData);
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to log in. Please try again.'));
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
          <h2>Log in to FixSquad</h2>
          <p className="auth-intro">Enter the details you used when creating your account.</p>

          {error && <div className="form-alert" role="alert">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
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

          <p className="auth-switch">New to FixSquad? <Link to="/register">Create an account</Link></p>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
