import DashboardLayout from '../../components/DashboardLayout';

export default function EmployerDashboard() {
  return (
    <DashboardLayout title="Employer Dashboard" accent="success">
      <div className="card shadow-sm">
        <div className="card-body">
          <h5 className="card-title">Your workspace</h5>
          <p className="card-text text-muted mb-0">
            This is the employer area. Add nested routes under <code>/employer/*</code> to
            build job posting, worker matching and performance review features.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
