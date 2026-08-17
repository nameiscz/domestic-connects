import type { Role } from '../types';

// Role → home route mapping, shared by App, ProtectedRoute, Login and Register.
// Role strings must match the backend Role enum (WORKER / EMPLOYER / ADMIN).
export const ROLE_HOME: Record<Role, string> = {
  WORKER: '/worker',
  EMPLOYER: '/employer',
  ADMIN: '/admin',
};

export const ROLES: { value: Role; label: string }[] = [
  { value: 'WORKER', label: 'Worker' },
  { value: 'EMPLOYER', label: 'Employer' },
  { value: 'ADMIN', label: 'Admin' },
];
