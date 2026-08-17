/**
 * Payroll domain types — mirrors payroll-service `SalaryRecordResponse`.
 * Salary-slip PDFs are downloaded as blobs (see payrollApi).
 */

export interface SalaryRecord {
  id: number;
  workerId: number;
  workerName: string;
  month: number;
  year: number;
  presentDays: number;
  halfDays: number;
  wagePerDay: number;
  grossSalary: number;
  generatedAt: string;
}

/** Metadata describing a downloadable salary-slip PDF. */
export interface SalarySlipFile {
  blob: Blob;
  filename: string;
}
