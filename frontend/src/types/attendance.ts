/**
 * Attendance domain types — mirrors attendance-service `AttendanceResponse`,
 * `WorkerAttendanceReport`, `AttendanceSummary` and `AttendanceRequest`.
 */

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY';

export interface Attendance {
  id: number;
  workerId: number;
  jobId: number;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  status: AttendanceStatus;
  createdAt: string;
}

export interface AttendanceSummary {
  workerId: number;
  month: number;
  year: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  totalDays: number;
}

export interface WorkerAttendanceReport {
  workerId: number;
  month: number;
  year: number;
  records: Attendance[];
  summary: AttendanceSummary | null;
}

export interface MarkAttendancePayload {
  workerId: number;
  jobId: number;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  status: AttendanceStatus;
}
