import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Shared shell for the three role dashboards: a Bootstrap navbar with the
 * signed-in user's name/role and a logout button, plus an <Outlet /> so
 * nested routes (e.g. /worker/jobs) render inside the same layout.
 */
export default function DashboardLayout({ title, accent = 'primary', children }) {
  const { currentUser, logout } = useAuth();

  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <nav className="navbar navbar-expand navbar-dark bg-primary shadow-sm">
        <div className="container-fluid px-4">
          <span className="navbar-brand fw-bold mb-0 h1">Domestic Connects</span>
          <span className={`badge bg-${accent} text-uppercase me-auto ms-3`}>
            {currentUser?.role || ''}
          </span>
          <ul className="navbar-nav ms-auto align-items-center gap-3">
            <li className="nav-item">
              <span className="navbar-text text-white-50 d-none d-sm-inline">
                Welcome, <strong className="text-white">{currentUser?.name}</strong>
              </span>
            </li>
            <li className="nav-item">
              <button className="btn btn-outline-light btn-sm" onClick={logout}>
                Log out
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <main className="container-fluid flex-grow-1 py-4">
        <h2 className="h4 mb-4">{title}</h2>
        {children}
        {/* Nested routes (e.g. /worker/jobs) render here inside the shell. */}
        <Outlet />
      </main>
    </div>
  );
}
