import axiosInstance from './axiosInstance';
import type {
  AdminUserInfo,
  ApiResponse,
  DashboardAnalytics,
  DashboardSummary,
  JobPost,
} from '../types';

/** Admin-service endpoints, routed through the gateway at /api/admin/** */
export const adminApi = {
  /** GET /api/admin/dashboard/summary */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const { data } = await axiosInstance.get<ApiResponse<DashboardSummary>>(
      '/api/admin/dashboard/summary'
    );
    return data.data;
  },

  /** GET /api/admin/users — full user directory. */
  async getUsers(): Promise<AdminUserInfo[]> {
    const { data } = await axiosInstance.get<ApiResponse<AdminUserInfo[]>>(
      '/api/admin/users'
    );
    return data.data;
  },

  /** GET /api/admin/jobs — all job posts (incl. closed). */
  async getJobs(): Promise<JobPost[]> {
    const { data } = await axiosInstance.get<ApiResponse<JobPost[]>>('/api/admin/jobs');
    return data.data;
  },

  /** GET /api/admin/dashboard/analytics?month=yyyy-MM */
  async getAnalytics(month?: string): Promise<DashboardAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<DashboardAnalytics>>(
      '/api/admin/dashboard/analytics',
      { params: { month } }
    );
    return data.data;
  },
};
