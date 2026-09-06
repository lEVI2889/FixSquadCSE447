import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

function DashboardPage() {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider';

  return (
    <section className="dashboard-page">
      <div className="container">
        <div className="dashboard-heading">
          <p className="eyebrow"><span /> Your workspace</p>
          <h1>Welcome, {user?.name?.split(' ')[0] || 'friend'}.</h1>
          <p>{isProvider ? 'Manage your service business from one place.' : 'Your FixSquad activity will appear here.'}</p>
        </div>
        <div className="dashboard-grid">
          <article className="dashboard-card dashboard-card--accent">
            <span className="dashboard-card__icon">{isProvider ? '✦' : '⌂'}</span>
            <p>{isProvider ? 'Provider account' : 'Customer account'}</p>
            <h2>{isProvider ? 'Build your service portfolio' : 'Ready when you need a hand'}</h2>
            <p>{isProvider ? 'Add the services and prices customers can book.' : 'Search and booking tools will be available here as the team integrates them.'}</p>
            {isProvider && <Link className="button button--light" to="/provider/portfolio">Manage services →</Link>}
          </article>
          <article className="dashboard-card">
            <span className="card-label">Account</span>
            <h3>{user?.name || 'FixSquad member'}</h3>
            <dl className="account-details">
              <div><dt>Email</dt><dd>{user?.email || 'Connected account'}</dd></div>
              <div><dt>Role</dt><dd>{user?.role || 'Member'}</dd></div>
            </dl>
          </article>
        </div>
      </div>
    </section>
  );
}

export default DashboardPage;
