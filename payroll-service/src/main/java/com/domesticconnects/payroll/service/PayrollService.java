package com.domesticconnects.payroll.service;

import com.domesticconnects.payroll.client.AttendanceServiceClient;
import com.domesticconnects.payroll.client.JobServiceClient;
import com.domesticconnects.payroll.dto.CsvExport;
import com.domesticconnects.payroll.dto.JobPostResponse;
import com.domesticconnects.payroll.dto.SalaryRecordResponse;
import com.domesticconnects.payroll.dto.SalarySlip;
import com.domesticconnects.payroll.dto.WorkerAttendanceReport;
import com.domesticconnects.payroll.entity.SalaryRecord;
import com.domesticconnects.payroll.exception.ResourceNotFoundException;
import com.domesticconnects.payroll.repository.SalaryRecordRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Orchestrates salary-slip generation:
 * <ol>
 *   <li>Fetches the worker's present days for the month from attendance-service.</li>
 *   <li>Fetches the wage per day from the job they are assigned to (job-service).</li>
 *   <li>Computes gross salary as {@code (presentDays + halfDays/2) * wagePerDay} —
 *       half-day attendances count at half a day.</li>
 *   <li>Renders the PDF slip and persists a {@link SalaryRecord} for history.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class PayrollService {

    private static final Logger log = LoggerFactory.getLogger(PayrollService.class);

    private final AttendanceServiceClient attendanceServiceClient;
    private final JobServiceClient jobServiceClient;
    private final SalaryRecordRepository salaryRecordRepository;
    private final SalarySlipPdfGenerator salarySlipPdfGenerator;

    /**
     * Generates (and persists) the monthly salary slip for a worker.
     *
     * @param workerId   the worker to generate the slip for
     * @param month      1-12
     * @param year       e.g. 2026
     * @param workerName optional display name; falls back to {@code Worker <id>}
     * @return the generated PDF bytes and download filename
     */
    @Transactional
    public SalarySlip generateSalarySlip(Long workerId, int month, int year, String workerName) {
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("Month must be between 1 and 12");
        }

        // 1. Present / half days from attendance-service
        WorkerAttendanceReport attendance =
                attendanceServiceClient.getWorkerAttendance(workerId, month, year);
        long presentDays = attendance != null && attendance.getSummary() != null
                ? attendance.getSummary().getPresentDays()
                : 0L;
        long halfDays = attendance != null && attendance.getSummary() != null
                ? attendance.getSummary().getHalfDays()
                : 0L;

        // 2. Wage per day from the job the worker attended during the month
        Long jobId = resolveAssignedJobId(workerId, month, year, attendance);
        JobPostResponse job = jobServiceClient.getJobPost(jobId);
        if (job == null || job.getWagePerDay() == null) {
            throw new IllegalArgumentException("No wage per day configured for the worker's job");
        }
        BigDecimal wagePerDay = job.getWagePerDay();

        // 3. Gross salary = (presentDays + halfDays / 2) * wagePerDay
        BigDecimal paidDays = BigDecimal.valueOf(presentDays)
                .add(BigDecimal.valueOf(halfDays).divide(BigDecimal.valueOf(2)));
        BigDecimal grossSalary = paidDays.multiply(wagePerDay);

        String resolvedName = (workerName == null || workerName.isBlank())
                ? "Worker " + workerId
                : workerName.trim();

        // 4. Persist history, then render the PDF
        SalaryRecord record = SalaryRecord.builder()
                .workerId(workerId)
                .workerName(resolvedName)
                .month(month)
                .year(year)
                .presentDays((int) presentDays)
                .halfDays((int) halfDays)
                .wagePerDay(wagePerDay)
                .grossSalary(grossSalary)
                .build();
        salaryRecordRepository.save(record);

        byte[] pdfBytes = salarySlipPdfGenerator.generate(record);

        log.info("Salary slip generated for worker {} for {}/{} (presentDays={}, gross={})",
                workerId, month, year, presentDays, grossSalary);

        return new SalarySlip(pdfBytes, buildFilename(workerId, month, year));
    }

    /**
     * Returns the worker's persisted payroll history, optionally filtered by
     * month/year. Both filters must be supplied together.
     */
    @Transactional(readOnly = true)
    public List<SalaryRecordResponse> getSalaryHistory(Long workerId,
                                                       Integer month, Integer year) {
        if ((month == null) != (year == null)) {
            throw new IllegalArgumentException("Both month and year must be provided together");
        }
        if (month != null && (month < 1 || month > 12)) {
            throw new IllegalArgumentException("Month must be between 1 and 12");
        }

        List<SalaryRecord> records = (month == null)
                ? salaryRecordRepository.findByWorkerIdOrderByGeneratedAtDesc(workerId)
                : salaryRecordRepository.findByWorkerIdAndMonthAndYearOrderByGeneratedAtDesc(
                        workerId, month, year);

        return records.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Generates a salary slip for every worker with attendance in the given
     * month/year. Each slip is persisted as a {@link SalaryRecord} exactly like
     * the single-slip flow, and the PDFs are returned for the caller to zip up.
     */
    public List<SalarySlip> generateBatchSalarySlips(int month, int year) {
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("Month must be between 1 and 12");
        }

        List<Long> workerIds = attendanceServiceClient.getWorkerIdsWithAttendance(month, year);
        if (workerIds == null || workerIds.isEmpty()) {
            throw new ResourceNotFoundException("Workers with attendance", "month/year",
                    month + "/" + year);
        }

        log.info("Generating batch salary slips for {} workers for {}/{}",
                workerIds.size(), month, year);

        // One worker must not break the whole payroll run: generate each slip
        // independently and skip (with a warning) any worker that fails, so the
        // caller still receives the successful slips.
        List<SalarySlip> slips = new ArrayList<>();
        for (Long workerId : workerIds) {
            try {
                slips.add(generateSalarySlip(workerId, month, year, null));
            } catch (RuntimeException e) {
                log.warn("Skipping salary slip for worker {} for {}/{}: {}",
                        workerId, month, year, e.getMessage());
            }
        }
        return slips;
    }

    /**
     * Exports the worker's persisted payroll history as CSV text.
     */
    public CsvExport exportHistoryCsv(Long workerId, Integer month, Integer year) {
        List<SalaryRecordResponse> history = getSalaryHistory(workerId, month, year);
        return new CsvExport(buildCsv(history), buildCsvFilename(workerId, month, year));
    }

    private String buildCsv(List<SalaryRecordResponse> records) {
        StringBuilder csv = new StringBuilder();
        csv.append("ID,Worker ID,Worker Name,Month,Year,Present Days,Half Days,")
                .append("Wage Per Day,Gross Salary,Generated At\r\n");
        for (SalaryRecordResponse record : records) {
            csv.append(record.getId()).append(',')
                    .append(record.getWorkerId()).append(',')
                    .append(csvEscape(record.getWorkerName())).append(',')
                    .append(record.getMonth()).append(',')
                    .append(record.getYear()).append(',')
                    .append(record.getPresentDays()).append(',')
                    .append(record.getHalfDays() == null ? 0 : record.getHalfDays()).append(',')
                    .append(formatAmount(record.getWagePerDay())).append(',')
                    .append(formatAmount(record.getGrossSalary())).append(',')
                    .append(record.getGeneratedAt() == null ? "" : record.getGeneratedAt())
                    .append("\r\n");
        }
        return csv.toString();
    }

    private String csvEscape(String value) {
        if (value == null) {
            return "";
        }
        // Defend against spreadsheet formula injection: a leading =, +, -, @ or
        // tab would otherwise be interpreted as a formula by Excel/Sheets.
        if (!value.isEmpty() && "=+-@\t".indexOf(value.charAt(0)) >= 0) {
            value = "'" + value;
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")
                || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    /**
     * Plain two-decimal amount without grouping (e.g. {@code 12500.00}) so
     * spreadsheet applications treat the column as numeric.
     */
    private String formatAmount(BigDecimal amount) {
        return amount == null ? "" : String.format(Locale.US, "%.2f", amount);
    }

    private String buildCsvFilename(Long workerId, Integer month, Integer year) {
        String period = month != null ? "-" + month + "-" + year : "";
        return "salary-history-" + workerId + period + ".csv";
    }

    /**
     * Determines the job id the worker was assigned to during the period. The
     * wage is resolved from the <b>first</b> attendance record's job id; if a
     * worker attends under several jobs within one month, only that job's wage
     * applies (a deliberate simplification of the {@code presentDays * wagePerDay}
     * formula). Without any attendance record the wage cannot be resolved, so a
     * 404 is raised.
     */
    private Long resolveAssignedJobId(Long workerId, int month, int year,
                                      WorkerAttendanceReport attendance) {
        if (attendance == null || attendance.getRecords() == null
                || attendance.getRecords().isEmpty()) {
            throw new ResourceNotFoundException("Attendance records", "workerId",
                    String.format("%d for month %d of %d", workerId, month, year));
        }
        Long jobId = attendance.getRecords().get(0).getJobId();
        if (jobId == null) {
            throw new ResourceNotFoundException("Assigned job", "workerId", workerId);
        }
        return jobId;
    }

    private String buildFilename(Long workerId, int month, int year) {
        return "salary-slip-" + workerId + "-" + month + "-" + year + ".pdf";
    }

    private SalaryRecordResponse toResponse(SalaryRecord record) {
        return SalaryRecordResponse.builder()
                .id(record.getId())
                .workerId(record.getWorkerId())
                .workerName(record.getWorkerName())
                .month(record.getMonth())
                .year(record.getYear())
                .presentDays(record.getPresentDays())
                .halfDays(record.getHalfDays())
                .wagePerDay(record.getWagePerDay())
                .grossSalary(record.getGrossSalary())
                .generatedAt(record.getGeneratedAt())
                .build();
    }
}
