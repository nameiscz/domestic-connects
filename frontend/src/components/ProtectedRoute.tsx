import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import type { Role } from '../types';

/**
 * Guards a route:
 *  - Unauthenticated users are redirected to /login (remembering where
 *    they were heading so login can send them back).
 *  - When `allowedRoles` is provided, users whose role is not listed are
 *    redirected to their own role's dashboard instead.
 *
 * Usage:
 *   <ProtectedRoute allowedRoles={['EMPLOYER', 'ADMIN']}>
 *     <EmployerDashboard />
 *   </ProtectedRoute>
 */

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    const fallback = ROLE_HOME[currentUser.role] || '/login';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
