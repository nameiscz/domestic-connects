import type { AxiosRequestConfig } from 'axios';
import axiosInstance from './axiosInstance';
import type { ApiResponse, SalaryRecord, SalarySlipFile } from '../types';

/** Payroll-service endpoints, routed through the gateway at /api/payroll/** */

/**
 * Parses the RFC 5987/6266 `filename` out of a Content-Disposition header.
 * Falls back to a caller-provided default when the header is missing.
 */
function filenameFromDisposition(
  disposition: string | null | undefined,
  fallback: string
): string {
  if (!disposition) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1]?.trim() || fallback;
}

/** Downloads a blob response and returns { blob, filename }. */
async function download(url: string, fallbackName: string): Promise<SalarySlipFile> {
  const response = await axiosInstance.get<Blob>(url, { responseType: 'blob' });
  return {
    blob: response.data,
    filename: filenameFromDisposition(
      response.headers['content-disposition'],
      fallbackName
    ),
  };
}

export const payrollApi = {
  /** GET /api/payroll/{workerId}/slip?month=&year=&workerName= → PDF. */
  async getSalarySlip(
    workerId: number,
    month: number,
    year: number,
    workerName?: string
  ): Promise<SalarySlipFile> {
    const response = await axiosInstance.get<Blob>(`/api/payroll/${workerId}/slip`, {
      params: { month, year, workerName },
      responseType: 'blob',
    });
    return {
      blob: response.data,
      filename: filenameFromDisposition(
        response.headers['content-disposition'],
        `salary-slip-${month}-${year}.pdf`
      ),
    };
  },

  /** GET /api/payroll/{workerId}/history?month=&year= */
  async getSalaryHistory(
    workerId: number,
    month?: number,
    year?: number,
    config?: AxiosRequestConfig
  ): Promise<SalaryRecord[]> {
    const { data } = await axiosInstance.get<ApiResponse<SalaryRecord[]>>(
      `/api/payroll/${workerId}/history`,
      { params: { month, year }, ...config }
    );
    return data.data;
  },

  /** GET /api/payroll/{workerId}/history/export → CSV. */
  async exportHistoryCsv(
    workerId: number,
    month?: number,
    year?: number
  ): Promise<SalarySlipFile> {
    const query =
      month && year ? `?month=${month}&year=${year}` : '';
    return download(
      `/api/payroll/${workerId}/history/export${query}`,
      `salary-history-${workerId}.csv`
    );
  },

  /** GET /api/payroll/batch/slips?month=&year= → ZIP of all slips. */
  async getBatchSlips(month: number, year: number): Promise<SalarySlipFile> {
    return download(
      `/api/payroll/batch/slips?month=${month}&year=${year}`,
      `salary-slips-${month}-${year}.zip`
    );
  },
};
