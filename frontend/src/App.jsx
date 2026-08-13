import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ROLE_HOME } from './constants/roles';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import JobBrowse from './pages/worker/JobBrowse';
import MyAttendance from './pages/worker/MyAttendance';
import MySalarySlips from './pages/worker/MySalarySlips';
import MyPerformance from './pages/worker/MyPerformance';
import Notifications from './pages/worker/Notifications';
import EmployerDashboard from './pages/employer/EmployerDashboard';
import MyJobPosts from './pages/employer/MyJobPosts';
import PostJob from './pages/employer/PostJob';
import MarkAttendance from './pages/employer/MarkAttendance';
import SubmitReview from './pages/SubmitReview';
import ManageReviews from './pages/ManageReviews';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminUsers from './pages/admin/AdminUsers';
import AdminJobs from './pages/admin/AdminJobs';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import PlaceholderPage from './components/PlaceholderPage';

/** Redirects "/" to the signed-in user's dashboard (or /login). */
function HomeRedirect() {
  const { currentUser } = useAuth();
  const home = currentUser ? ROLE_HOME[currentUser.role] || '/login' : '/login';
  return <Navigate to={home} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Role-gated dashboards (nested routes render via <Outlet />) */}
          <Route
            path="/worker"
            element={
              <ProtectedRoute allowedRoles={['WORKER']}>
                <WorkerDashboard />
              </ProtectedRoute>
            }
          >
            <Route path="jobs" element={<JobBrowse />} />
            <Route path="attendance" element={<MyAttendance />} />
            <Route path="salary-slips" element={<MySalarySlips />} />
            <Route path="performance" element={<MyPerformance />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
          <Route
            path="/employer"
            element={
              <ProtectedRoute allowedRoles={['EMPLOYER']}>
                <EmployerDashboard />
              </ProtectedRoute>
            }
          >
            <Route path="jobs" element={<MyJobPosts />} />
            <Route path="jobs/new" element={<PostJob />} />
            <Route path="jobs/edit/:id" element={<PostJob />} />
            <Route path="attendance" element={<MarkAttendance />} />
            <Route path="reviews" element={<ManageReviews />} />
            <Route path="reviews/new" element={<SubmitReview />} />
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          >
            <Route path="users" element={<AdminUsers />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="reviews" element={<ManageReviews />} />
            <Route path="reviews/new" element={<SubmitReview />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route
              path="audit-logs"
              element={
                <PlaceholderPage
                  title="Audit Logs"
                  description="Platform-wide audit trails will appear here once the audit-log view is built."
                />
              }
            />
            {/* Other /admin/* URLs keep showing the admin workspace overview. */}
            <Route path="*" element={null} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
