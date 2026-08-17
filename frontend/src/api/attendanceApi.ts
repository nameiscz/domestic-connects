import type { AxiosRequestConfig } from 'axios';
import axiosInstance from './axiosInstance';
import type {
  Attendance,
  MarkAttendancePayload,
  WorkerAttendanceReport,
} from '../types';

/** Attendance-service endpoints, routed through the gateway at /api/attendance/** */
export const attendanceApi = {
  /** POST /api/attendance/mark — employer/admin only. */
  async markAttendance(payload: MarkAttendancePayload): Promise<Attendance> {
    const { data } = await axiosInstance.post<Attendance>('/api/attendance/mark', payload);
    return data;
  },

  /** GET /api/attendance/worker/{workerId}?month=&year= */
  async getWorkerAttendance(
    workerId: number,
    month?: number,
    year?: number,
    config?: AxiosRequestConfig
  ): Promise<WorkerAttendanceReport> {
    const query = month && year ? `?month=${month}&year=${year}` : '';
    const { data } = await axiosInstance.get<WorkerAttendanceReport>(
      `/api/attendance/worker/${workerId}${query}`,
      config
    );
    return data;
  },

  /** GET /api/attendance/workers?month=&year= — worker ids with attendance. */
  async getWorkersWithAttendance(month?: number, year?: number): Promise<number[]> {
    const { data } = await axiosInstance.get<number[]>('/api/attendance/workers', {
      params: { month, year },
    });
    return data;
  },
};
