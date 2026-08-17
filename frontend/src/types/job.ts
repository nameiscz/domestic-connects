/**
 * Job post domain types — mirrors job-service `JobPostResponse`,
 * `JobApplicationResponse` and `JobPostRequest`.
 */

export type JobStatus = 'OPEN' | 'ASSIGNED' | 'CLOSED';

export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface JobPost {
  id: number;
  title: string;
  description: string;
  employerId: number;
  /** Assigned worker, or null while the post is OPEN. */
  workerId: number | null;
  /** True when the employer reviewed the worker's profile before assigning. */
  profileReviewed: boolean;
  wagePerDay: number;
  location: string;
  status: JobStatus;
  createdAt: string;
}

export interface JobApplication {
  id: number;
  jobId: number;
  jobTitle: string;
  workerId: number;
  status: ApplicationStatus;
  createdAt: string;
}

export interface CreateJobPayload {
  title: string;
  description: string;
  employerId: number;
  wagePerDay: number;
  location: string;
}
