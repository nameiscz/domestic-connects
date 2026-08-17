import type { JobStatus } from './job';
import type { Role } from './user';

/**
 * Admin domain types — mirrors admin-service `DashboardAnalytics` and the
 * per-service `AuditLog` entity (written into each service's `audit_logs`
 * table by the `@Auditable` aspect).
 */

/** High-level dashboard counts (GET /api/admin/dashboard/summary). */
export interface DashboardSummary {
  totalUsers: number;
  activeUsers: number;
  totalJobs: number;
  activeJobs: number;
  inactiveJobs: number;
  /** Attendance rate for the current month (0–100), null when unavailable. */
  monthlyAttendanceRate: number | null;
  /** Average performance rating (1–5), null when unavailable. */
  averagePerformanceRating: number | null;
  totalReviews: number;
  generatedAt: string;
}

export interface DashboardAnalytics {
  usersByRole: Partial<Record<Role, number>>;
  jobsByStatus: Partial<Record<JobStatus, number>>;
  activeJobs: number;
  inactiveJobs: number;
  /** Attendance rate as a percentage (0–100), null when unknown. */
  monthlyAttendanceRate: number | null;
  /** Average performance rating (1–5), null when no reviews exist. */
  averagePerformanceRating: number | null;
  totalReviews: number;
}

/** One row of the per-service `audit_logs` table. */
export interface AuditLog {
  id: number;
  /** Caller's user id (gateway-forwarded `X-User-Id`). */
  actorId: string;
  /** Caller's role (gateway-forwarded `X-User-Role`). */
  actorRole: string;
  /** Business action, e.g. CREATE / UPDATE / DELETE / ASSIGN. */
  action: string;
  /** Entity type, e.g. JobPost / User / SalaryRecord. */
  entityType: string;
  entityId: string;
  /** JSON summary of the pre-change state (may be null). */
  oldValue: string | null;
  /** JSON summary of the post-change state (may be null). */
  newValue: string | null;
  detail: string | null;
  success: boolean;
  createdAt: string;
}
