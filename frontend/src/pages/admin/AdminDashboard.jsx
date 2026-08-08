import DashboardLayout from '../../components/DashboardLayout';

export default function AdminDashboard() {
  return (
    <DashboardLayout title="Admin Dashboard" accent="danger">
      <div className="card shadow-sm">
        <div className="card-body">
          <h5 className="card-title">Your workspace</h5>
          <p className="card-text text-muted mb-0">
            This is the admin area. Add nested routes under <code>/admin/*</code> to
            build user management, audit logs, and platform-wide reports.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
