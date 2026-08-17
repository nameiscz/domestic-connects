import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ROLE_HOME } from './constants/roles';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import JobBrowse from './pages/worker/JobBrowse';
import MyAttendance from './pages/worker/MyAttendance';
import MySalarySlips from './pages/worker/MySalarySlips';
import MyPerformance from './pages/worker/MyPerformance';
import Notifications from './pages/worker/Notifications';
import EmployerDashboard from './pages/employer/EmployerDashboard';
import MyJobPosts from './pages/employer/MyJobPosts';
import WorkerProfile from './pages/employer/WorkerProfile';
import PostJob from './pages/employer/PostJob';
import MarkAttendance from './pages/employer/MarkAttendance';
import SubmitReview from './pages/SubmitReview';
import ManageReviews from './pages/ManageReviews';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAttendance from './pages/admin/AdminAttendance';
import UserManagement from './pages/admin/UserManagement';
import JobManagement from './pages/admin/JobManagement';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AuditLogs from './pages/admin/AuditLogs';
import PageTitle from './components/PageTitle';

/**
 * Home route: signed-in users go straight to their dashboard; everyone else
 * sees the public marketing landing page.
 */
function Home() {
  const { currentUser } = useAuth();
  if (currentUser) {
    return <Navigate to={ROLE_HOME[currentUser.role] || '/login'} replace />;
  }
  return <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Keeps the browser tab title in sync with the current route. */}
      <PageTitle />
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

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
            <Route path="workers/:id" element={<WorkerProfile />} />
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
            <Route path="users" element={<UserManagement />} />
            <Route path="jobs" element={<JobManagement />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="reviews" element={<ManageReviews />} />
            <Route path="reviews/new" element={<SubmitReview />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="audit-logs" element={<AuditLogs />} />
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
