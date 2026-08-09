import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { NAV_LINKS } from '../constants/navLinks';

/**
 * Shared navbar for the signed-in area. Renders the navigation links for the
 * current user's role (WORKER / EMPLOYER / ADMIN), a role badge, the user's
 * name, and a Logout button that clears the session via AuthContext.logout()
 * and redirects to /login.
 *
 * Mounted by DashboardLayout, so it is visible across every role dashboard
 * (including nested routes like /worker/jobs).
 */

// Role → Bootstrap accent for the role badge (mirrors each dashboard's color).
const ROLE_ACCENT = {
  WORKER: 'primary',
  EMPLOYER: 'success',
  ADMIN: 'danger',
};

export default function Navbar({ accent }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const role = currentUser?.role;
  const links = NAV_LINKS[role] || [];
  const homePath = ROLE_HOME[role] || '/login';
  const badgeAccent = accent || ROLE_ACCENT[role] || 'primary';

  const handleLogout = () => {
    logout();
    // Redirect explicitly (replace so the Back button doesn't land back on
    // the dashboard the user just logged out of).
    navigate('/login', { replace: true });
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm sticky-top">
      <div className="container-fluid px-4">
        <Link className="navbar-brand fw-bold" to={homePath}>
          Domestic Connects
        </Link>

        {role && (
          <span className={`badge bg-${badgeAccent} text-uppercase me-3`}>
            {role}
          </span>
        )}

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#app-navbar"
          aria-controls="app-navbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="app-navbar">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {links.map(({ to, label, end }) => (
              <li className="nav-item" key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' active' : ''}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-3">
            <li className="nav-item">
              <span className="navbar-text text-white-50 d-none d-md-inline">
                Welcome, <strong className="text-white">{currentUser?.name}</strong>
              </span>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className="btn btn-outline-light btn-sm"
                onClick={handleLogout}
              >
                Log out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
