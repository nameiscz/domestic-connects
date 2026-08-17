import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarCheck,
  LayoutDashboard,
  PenLine,
  PlusCircle,
  ScrollText,
  Star,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '../types';

// Role → navbar links, shared by the Navbar component.
// The order matches the app's information architecture. Icons render in the
// desktop nav only (the mobile drawer keeps text-only rows for density).

export interface NavLinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** `end` keeps the link from staying active on nested routes. */
  end?: boolean;
}

export const NAV_LINKS: Record<Role, NavLinkItem[]> = {
  WORKER: [
    { to: '/worker', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/worker/jobs', label: 'Jobs', icon: Briefcase },
    { to: '/worker/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/worker/salary-slips', label: 'Salary', icon: Wallet },
    { to: '/worker/performance', label: 'Performance', icon: Star },
    { to: '/worker/notifications', label: 'Notifications', icon: Bell },
  ],
  EMPLOYER: [
    { to: '/employer', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/employer/jobs/new', label: 'Post Job', icon: PlusCircle },
    // `end` keeps "My Job Posts" from staying active while on the new/edit forms.
    { to: '/employer/jobs', label: 'My Job Posts', icon: Briefcase, end: true },
    { to: '/employer/attendance', label: 'Mark Attendance', icon: CalendarCheck, end: true },
    { to: '/employer/reviews', label: 'Manage Reviews', icon: Star, end: true },
    { to: '/employer/reviews/new', label: 'Submit Review', icon: PenLine, end: true },
  ],
  ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/jobs', label: 'Jobs', icon: Briefcase },
    { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/admin/reviews', label: 'Manage Reviews', icon: Star, end: true },
    { to: '/admin/reviews/new', label: 'Submit Review', icon: PenLine, end: true },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  ],
};
