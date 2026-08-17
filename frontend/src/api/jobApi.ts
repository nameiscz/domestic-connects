import type { AxiosRequestConfig } from 'axios';
import axiosInstance from './axiosInstance';
import type {
  ApiResponse,
  CreateJobPayload,
  JobApplication,
  JobPost,
} from '../types';

/** Job-service endpoints, routed through the gateway at /api/jobs/** */
export const jobApi = {
  /** GET /api/jobs — all job posts (workers browse; employers filter client-side). */
  async listJobs(config?: AxiosRequestConfig): Promise<JobPost[]> {
    const { data } = await axiosInstance.get<JobPost[]>('/api/jobs', config);
    return data;
  },

  /** GET /api/jobs/{id} */
  async getJob(id: number, config?: AxiosRequestConfig): Promise<JobPost> {
    const { data } = await axiosInstance.get<JobPost>(`/api/jobs/${id}`, config);
    return data;
  },

  /** POST /api/jobs — employer/admin only. */
  async createJob(payload: CreateJobPayload): Promise<JobPost> {
    const { data } = await axiosInstance.post<JobPost>('/api/jobs', payload);
    return data;
  },

  /** PUT /api/jobs/{id} — employer/admin only. */
  async updateJob(id: number, payload: CreateJobPayload): Promise<JobPost> {
    const { data } = await axiosInstance.put<JobPost>(`/api/jobs/${id}`, payload);
    return data;
  },

  /** DELETE /api/jobs/{id} — soft delete; employer/admin only. */
  async deleteJob(id: number): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(`/api/jobs/${id}`);
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete job');
    }
  },

  /** POST /api/jobs/{id}/assign/{workerId} — worker self-apply path. */
  async assignWorker(id: number, workerId: number): Promise<JobPost> {
    const { data } = await axiosInstance.post<JobPost>(
      `/api/jobs/${id}/assign/${workerId}`
    );
    return data;
  },

  /** POST /api/jobs/{id}/assign/{workerId}/reviewed — employer/admin path. */
  async assignWorkerReviewed(id: number, workerId: number): Promise<JobPost> {
    const { data } = await axiosInstance.post<JobPost>(
      `/api/jobs/${id}/assign/${workerId}/reviewed`
    );
    return data;
  },

  /** POST /api/jobs/{id}/apply — worker applies to an OPEN job. */
  async applyToJob(id: number): Promise<JobApplication> {
    const { data } = await axiosInstance.post<JobApplication>(`/api/jobs/${id}/apply`);
    return data;
  },

  /** GET /api/jobs/{id}/applications — employer/admin applicant list. */
  async getApplications(id: number, config?: AxiosRequestConfig): Promise<JobApplication[]> {
    const { data } = await axiosInstance.get<JobApplication[]>(
      `/api/jobs/${id}/applications`,
      config
    );
    return data;
  },

  /** POST /api/jobs/{id}/applications/{applicationId}/accept */
  async acceptApplication(id: number, applicationId: number): Promise<JobPost> {
    const { data } = await axiosInstance.post<JobPost>(
      `/api/jobs/${id}/applications/${applicationId}/accept`
    );
    return data;
  },

  /** POST /api/jobs/{id}/applications/{applicationId}/decline */
  async declineApplication(id: number, applicationId: number): Promise<JobApplication> {
    const { data } = await axiosInstance.post<JobApplication>(
      `/api/jobs/${id}/applications/${applicationId}/decline`
    );
    return data;
  },

  /** GET /api/jobs/employer/{employerId}/workers — distinct assigned worker ids. */
  async getAssignedWorkers(employerId: number): Promise<number[]> {
    const { data } = await axiosInstance.get<number[]>(
      `/api/jobs/employer/${employerId}/workers`
    );
    return data;
  },
};
