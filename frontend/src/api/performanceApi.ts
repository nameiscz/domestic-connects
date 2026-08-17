import type { AxiosRequestConfig } from 'axios';
import axiosInstance from './axiosInstance';
import type {
  ApiResponse,
  PerformanceReview,
  SubmitReviewPayload,
  WorkerPerformanceReport,
} from '../types';

/** Performance-service endpoints, routed through the gateway at /api/performance/** */
export const performanceApi = {
  /** POST /api/performance/review — employer/admin only. */
  async submitReview(payload: SubmitReviewPayload): Promise<PerformanceReview> {
    const { data } = await axiosInstance.post<PerformanceReview>(
      '/api/performance/review',
      payload
    );
    return data;
  },

  /** PUT /api/performance/review/{id} — rating/remarks edit; employer/admin. */
  async updateReview(
    id: number,
    payload: { rating: number; remarks?: string }
  ): Promise<PerformanceReview> {
    const { data } = await axiosInstance.put<PerformanceReview>(
      `/api/performance/review/${id}`,
      payload
    );
    return data;
  },

  /** DELETE /api/performance/review/{id} — admin only. */
  async deleteReview(id: number): Promise<void> {
    const { data } = await axiosInstance.delete<ApiResponse<null>>(
      `/api/performance/review/${id}`
    );
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete review');
    }
  },

  /** GET /api/performance/worker/{workerId} — full report + rating distribution. */
  async getWorkerPerformance(
    workerId: number,
    config?: AxiosRequestConfig
  ): Promise<WorkerPerformanceReport> {
    const { data } = await axiosInstance.get<WorkerPerformanceReport>(
      `/api/performance/worker/${workerId}`,
      config
    );
    return data;
  },

  /** GET /api/performance/worker/{workerId}/history?page=&size= */
  async getWorkerHistory(
    workerId: number,
    page = 0,
    size = 10,
    config?: AxiosRequestConfig
  ): Promise<WorkerPerformanceReport> {
    const { data } = await axiosInstance.get<WorkerPerformanceReport>(
      `/api/performance/worker/${workerId}/history?page=${page}&size=${size}`,
      config
    );
    return data;
  },
};
