/**
 * Notification domain types — mirrors notification-service
 * `NotificationResponse`. The wire field is `isRead` (pinned via
 * `@JsonProperty` on the backend), so the type uses that exact name.
 */

export type NotificationType =
  | 'JOB_ASSIGNED'
  | 'SALARY_SLIP_GENERATED'
  | 'PERFORMANCE_REVIEWED';

export interface NotificationLog {
  id: number;
  userId: number;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}
