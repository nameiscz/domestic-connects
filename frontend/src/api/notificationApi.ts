import type { AxiosRequestConfig } from 'axios';
import axiosInstance from './axiosInstance';
import type { NotificationLog } from '../types';

/** Notification-service endpoints, routed through the gateway at /api/notifications/** */
export const notificationApi = {
  /** GET /api/notifications/{userId} — inbox, newest first. */
  async getNotifications(
    userId: number,
    config?: AxiosRequestConfig
  ): Promise<NotificationLog[]> {
    const { data } = await axiosInstance.get<NotificationLog[]>(
      `/api/notifications/${userId}`,
      config
    );
    return Array.isArray(data) ? data : [];
  },

  /** PATCH /api/notifications/{id}/read */
  async markAsRead(id: number): Promise<NotificationLog> {
    const { data } = await axiosInstance.patch<NotificationLog>(
      `/api/notifications/${id}/read`
    );
    return data;
  },
};
