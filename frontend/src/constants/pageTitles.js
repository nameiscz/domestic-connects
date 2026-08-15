// Route pathname → document-title suffix, used by <PageTitle />. Exact routes
// are matched first; dynamic paths (e.g. /employer/jobs/edit/:id) fall through
// to resolvePageTitle's prefix checks.
export const PAGE_TITLES = {
  // Public
  '/': 'Welcome',
  '/login': 'Sign in',
  '/register': 'Create account',
  '/reset-password': 'Reset password',

  // Worker
  '/worker': 'Worker Dashboard',
  '/worker/jobs': 'Browse Jobs',
  '/worker/attendance': 'My Attendance',
  '/worker/salary-slips': 'My Salary Slips',
  '/worker/performance': 'My Performance',
  '/worker/notifications': 'Notifications',

  // Employer
  '/employer': 'Employer Dashboard',
  '/employer/jobs': 'My Job Posts',
  '/employer/jobs/new': 'Post a Job',
  '/employer/attendance': 'Mark Attendance',
  '/employer/reviews': 'Manage Reviews',
  '/employer/reviews/new': 'Submit Review',

  // Admin
  '/admin': 'Admin Dashboard',
  '/admin/users': 'User Management',
  '/admin/jobs': 'Job Management',
  '/admin/attendance': 'Attendance',
  '/admin/reviews': 'Manage Reviews',
  '/admin/reviews/new': 'Submit Review',
  '/admin/analytics': 'Analytics',
  '/admin/audit-logs': 'Audit Logs',
};

/** Resolves a pathname to a title (or null for a generic fallback). */
export const resolvePageTitle = (pathname) => {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/employer/jobs/edit/')) return 'Edit Job';
  return null;
};
