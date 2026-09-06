import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getApiErrorMessage } from '../utils/authResponse';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  role: 'customer',
  password: '',
  confirmPassword: '',
};

function RegisterPage() {
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const { isAuthenticated, isAuthLoading, register } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      password: formData.password,
    };
    setError('');

    try {
      await register(payload);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to create your account. Please try again.'));
    }
  };

  return (
    <section className="auth-page auth-page--register">
      <div className="auth-aside">
        <div>
          <p className="eyebrow eyebrow--light"><span /> Join the squad</p>
          <h1>One account. A better way to get things done.</h1>
          <p>Book trusted help or grow your local service business.</p>
        </div>
        <ul className="aside-checks">
          <li>✓ Discover trusted local providers</li>
          <li>✓ Keep requests organized</li>
          <li>✓ Build a professional service profile</li>
        </ul>
      </div>

      <div className="auth-panel">
        <div className="auth-card auth-card--wide">
          <p className="auth-kicker">Create your account</p>
          <h2>Let’s get you started.</h2>
          <p className="auth-intro">Choose how you plan to use FixSquad.</p>

          {error && <div className="form-alert" role="alert">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <fieldset className="role-options">
              <legend>I want to</legend>
              <label className={formData.role === 'customer' ? 'role-card role-card--selected' : 'role-card'}>
                <input type="radio" name="role" value="customer" checked={formData.role === 'customer'} onChange={handleChange} />
                <span className="role-card__icon">⌂</span>
                <span><strong>Book a service</strong><small>I need help at home</small></span>
              </label>
              <label className={formData.role === 'provider' ? 'role-card role-card--selected' : 'role-card'}>
                <input type="radio" name="role" value="provider" checked={formData.role === 'provider'} onChange={handleChange} />
                <span className="role-card__icon">✦</span>
                <span><strong>Offer services</strong><small>I am a professional</small></span>
              </label>
            </fieldset>

            <div className="form-grid">
              <div className="field-group">
                <label htmlFor="name">Full name</label>
                <input autoComplete="name" id="name" name="name" onChange={handleChange} placeholder="Your full name" required value={formData.name} />
              </div>
              <div className="field-group">
                <label htmlFor="phone">Phone number</label>
                <input autoComplete="tel" id="phone" name="phone" onChange={handleChange} placeholder="01XXXXXXXXX" required type="tel" value={formData.phone} />
              </div>
            </div>

            <label htmlFor="email">Email address</label>
            <input autoComplete="email" id="email" name="email" onChange={handleChange} placeholder="you@example.com" required type="email" value={formData.email} />

            <div className="form-grid">
              <div className="field-group">
                <label htmlFor="password">Password</label>
                <input autoComplete="new-password" id="password" minLength="6" name="password" onChange={handleChange} placeholder="At least 6 characters" required type="password" value={formData.password} />
              </div>
              <div className="field-group">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input autoComplete="new-password" id="confirmPassword" minLength="6" name="confirmPassword" onChange={handleChange} placeholder="Repeat your password" required type="password" value={formData.confirmPassword} />
              </div>
            </div>

            <button className="button button--primary button--wide" disabled={isAuthLoading} type="submit">
              {isAuthLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
        </div>
      </div>
    </section>
  );
}

export default RegisterPage;
