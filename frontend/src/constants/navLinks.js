// Role → navbar links, shared by the Navbar component.
// The order matches the app's information architecture.
export const NAV_LINKS = {
  WORKER: [
    { to: '/worker/jobs', label: 'Jobs' },
    { to: '/worker/attendance', label: 'My Attendance' },
    { to: '/worker/salary-slips', label: 'My Salary Slips' },
    { to: '/worker/performance', label: 'My Performance' },
    { to: '/worker/notifications', label: 'Notifications' },
  ],
  EMPLOYER: [
    { to: '/employer/jobs/new', label: 'Post Job' },
    // `end` keeps "My Job Posts" from staying active while on the new/edit forms.
    { to: '/employer/jobs', label: 'My Job Posts', end: true },
  ],
  ADMIN: [
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/jobs', label: 'Jobs' },
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/audit-logs', label: 'Audit Logs' },
  ],
};
