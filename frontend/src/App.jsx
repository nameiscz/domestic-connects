import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ROLE_HOME } from './constants/roles';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import JobBrowse from './pages/worker/JobBrowse';
import WorkerAttendance from './pages/worker/WorkerAttendance';
import EmployerDashboard from './pages/employer/EmployerDashboard';
import MyJobPosts from './pages/employer/MyJobPosts';
import PostJob from './pages/employer/PostJob';
import MarkAttendance from './pages/employer/MarkAttendance';
import AdminDashboard from './pages/admin/AdminDashboard';

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
            <Route path="attendance" element={<WorkerAttendance />} />
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
          </Route>
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
