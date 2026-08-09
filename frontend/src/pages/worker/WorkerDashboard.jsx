import { NavLink, Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const NAV_ITEMS = [
  { to: '/worker', label: 'Overview', end: true },
  { to: '/worker/jobs', label: 'Browse Jobs' },
  { to: '/worker/attendance', label: 'My Attendance' },
];

export default function WorkerDashboard() {
  const { pathname } = useLocation();
  const isOverview = pathname === '/worker' || pathname === '/worker/';

  return (
    <DashboardLayout title="Worker Dashboard">
      <ul className="nav nav-pills gap-2 mb-4">
        {NAV_ITEMS.map(({ to, label, end }) => (
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

      {isOverview && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="card-title">Your workspace</h5>
            <p className="card-text text-muted mb-0">
              Welcome! Use <strong>Browse Jobs</strong> to find and apply to
              available work in your area.
            </p>
          </div>
        </div>
      )}

      {/* Nested routes (e.g. /worker/jobs) render here inside the shell. */}
      <Outlet />
    </DashboardLayout>
  );
}
