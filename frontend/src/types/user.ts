/**
 * User domain types — mirrors auth-service `AuthResponse.UserInfo` and
 * admin-service `UserInfo`. The backend serializes its `boolean isActive`
 * under the JavaBeans-derived wire name `"active"`, so the field is typed
 * `active` here.
 */

export type Role = 'WORKER' | 'EMPLOYER' | 'ADMIN';

/** A user as returned by the auth/admin services (no credentials). */
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** Wire name for `isActive` — present on admin/user-list payloads. */
  active?: boolean;
  /** Optional phone number. */
  phone?: string | null;
}

/** The persisted session shape stored under `dc_user` (User + access token). */
export interface SessionUser extends User {
  token: string;
}

/** Admin user-management row (admin-service `UserInfo`, wire field `active`). */
export interface AdminUserInfo {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}
