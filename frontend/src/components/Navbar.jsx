import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import BrandMark from './BrandMark';

const navLinkClass = ({ isActive }) =>
  `nav-link${isActive ? ' nav-link--active' : ''}`;

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const closeMenu = () => setIsMenuOpen(false);
  const handleLogout = () => {
    logout();
    closeMenu();
    navigate('/');
  };

  return (
    <header className="site-header">
      <nav className="navbar container" aria-label="Primary navigation">
        <Link className="brand" to="/" onClick={closeMenu}>
          <BrandMark />
          <span>Fix<span>Squad</span></span>
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="primary-menu"
          aria-label="Toggle navigation"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div
          className={`nav-content${isMenuOpen ? ' nav-content--open' : ''}`}
          id="primary-menu"
        >
          <div className="nav-links">
            <NavLink className={navLinkClass} to="/" onClick={closeMenu} end>
              Home
            </NavLink>
            <a className="nav-link" href="/#how-it-works" onClick={closeMenu}>
              How it works
            </a>
            {(!isAuthenticated || user?.role === 'customer') && (
              <NavLink className={navLinkClass} to="/services" onClick={closeMenu}>
                Book a Service
              </NavLink>
            )}
            {isAuthenticated && (
              <>
                <NavLink className={navLinkClass} to="/dashboard" onClick={closeMenu}>
                  Dashboard
                </NavLink>
                
                {user?.role === 'customer' && (
                  <NavLink className={navLinkClass} to="/customer/bookings" onClick={closeMenu}>
                    My Bookings
                  </NavLink>
                )}

                {user?.role === 'admin' && (
                  <NavLink className={navLinkClass} to="/admin/categories" onClick={closeMenu}>
                    Categories
                  </NavLink>
                )}
              </>
            )}
            {isAuthenticated && user?.role === 'provider' && (
              <>
                <NavLink
                  className={navLinkClass}
                  to="/provider/portfolio"
                  onClick={closeMenu}
                >
                  My services
                </NavLink>
                <NavLink
                  className={navLinkClass}
                  to="/provider/operations"
                  onClick={closeMenu}
                >
                  Operations
                </NavLink>
                <NavLink
                  className={navLinkClass}
                  to="/provider/jobs"
                  onClick={closeMenu}
                >
                  Job Workflow
                </NavLink>
              </>
            )}
          </div>

          <div className="nav-actions">
            {isAuthenticated ? (
              <>
                <span className="nav-user">Hi, {user?.name?.split(' ')[0] || 'there'}</span>
                <button className="button button--ghost" type="button" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link className="button button--ghost" to="/login" onClick={closeMenu}>
                  Log in
                </Link>
                <Link className="button button--primary button--small" to="/register" onClick={closeMenu}>
                  Join FixSquad
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
