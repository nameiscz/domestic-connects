import DashboardLayout from '../../components/DashboardLayout';

export default function WorkerDashboard() {
  return (
    <DashboardLayout title="Worker Dashboard">
      <div className="card shadow-sm">
        <div className="card-body">
          <h5 className="card-title">Your workspace</h5>
          <p className="card-text text-muted mb-0">
            This is the worker area. Add nested routes under <code>/worker/*</code> to
            build job listings, attendance, payroll slips and more.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
