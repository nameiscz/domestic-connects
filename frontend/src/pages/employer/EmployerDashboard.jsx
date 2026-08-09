import { NavLink, Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';

const NAV_ITEMS = [
  { to: '/employer', label: 'Overview', end: true },
  { to: '/employer/jobs', label: 'My Jobs' },
  { to: '/employer/jobs/new', label: 'Post a Job' },
  { to: '/employer/attendance', label: 'Attendance' },
];

export default function EmployerDashboard() {
  const { pathname } = useLocation();
  const isOverview = pathname === '/employer' || pathname === '/employer/';

  return (
    <DashboardLayout title="Employer Dashboard" accent="success">
      <ul className="nav nav-pills gap-2 mb-4">
        {NAV_ITEMS.map(({ to, label, end }) => (
          <li className="nav-item" key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
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
              Manage your job postings — create new ones, track their status and
              keep them up to date.
            </p>
          </div>
        </div>
      )}

      {/* Nested routes (e.g. /employer/jobs) render here inside the shell. */}
      <Outlet />
    </DashboardLayout>
  );
}
