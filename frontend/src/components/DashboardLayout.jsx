import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

/**
 * Shared shell for the three role dashboards: the responsive role-aware
 * <Navbar /> (brand, role links, user name and logout), a page title, and an
 * <Outlet /> so nested routes (e.g. /worker/jobs) render inside the same
 * layout. The `accent` prop is forwarded to the Navbar for the role badge
 * colour and defaults per role there, so passing it is optional.
 */
export default function DashboardLayout({ title, accent, children }) {
  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      <Navbar accent={accent} />

      <main className="container-fluid flex-grow-1 py-4">
        <h2 className="h4 mb-4">{title}</h2>
        {children}
        {/* Nested routes (e.g. /worker/jobs) render here inside the shell. */}
        <Outlet />
      </main>
    </div>
  );
}
