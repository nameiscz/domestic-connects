// Role → home route mapping, shared by App, ProtectedRoute, Login and Register.
// Role strings must match the backend Role enum (WORKER / EMPLOYER / ADMIN).
export const ROLE_HOME = {
  WORKER: '/worker',
  EMPLOYER: '/employer',
  ADMIN: '/admin',
};

export const ROLES = [
  { value: 'WORKER', label: 'Worker' },
  { value: 'EMPLOYER', label: 'Employer' },
  { value: 'ADMIN', label: 'Admin' },
];
