package com.domesticconnects.payroll.service;

import com.domesticconnects.payroll.client.AttendanceServiceClient;
import com.domesticconnects.payroll.client.JobServiceClient;
import com.domesticconnects.payroll.dto.AttendanceResponse;
import com.domesticconnects.payroll.dto.AttendanceSummary;
import com.domesticconnects.payroll.dto.CsvExport;
import com.domesticconnects.payroll.dto.JobPostResponse;
import com.domesticconnects.payroll.dto.SalaryRecordResponse;
import com.domesticconnects.payroll.dto.SalarySlip;
import com.domesticconnects.payroll.dto.WorkerAttendanceReport;
import com.domesticconnects.payroll.entity.SalaryRecord;
import com.domesticconnects.payroll.exception.ResourceNotFoundException;
import com.domesticconnects.payroll.repository.SalaryRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class PayrollServiceTest {

    @Mock
    private AttendanceServiceClient attendanceServiceClient;

    @Mock
    private JobServiceClient jobServiceClient;

    @Mock
    private SalaryRecordRepository salaryRecordRepository;

    @Mock
    private SalarySlipPdfGenerator salarySlipPdfGenerator;

    @Mock
    private NotificationPublisher notificationPublisher;

    @InjectMocks
    private PayrollService payrollService;

    @Test
    void calculatesGrossSalaryAndPersistsSalaryRecord() {
        WorkerAttendanceReport attendance = WorkerAttendanceReport.builder()
                .workerId(5L)
                .month(6)
                .year(2026)
                .records(List.of(AttendanceResponse.builder().workerId(5L).jobId(10L).build()))
                .summary(AttendanceSummary.builder().presentDays(24).build())
                .build();
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026)).thenReturn(attendance);
        when(jobServiceClient.getJobPost(10L)).thenReturn(
                JobPostResponse.builder().wagePerDay(new BigDecimal("500.00")).build());
        when(salarySlipPdfGenerator.generate(any(SalaryRecord.class)))
                .thenReturn(new byte[]{'%', 'P', 'D', 'F'});

        SalarySlip slip = payrollService.generateSalarySlip(5L, 6, 2026, "Ramesh Kumar");

        assertEquals("salary-slip-5-6-2026.pdf", slip.filename());
        assertArrayEquals(new byte[]{'%', 'P', 'D', 'F'}, slip.pdfBytes());

        ArgumentCaptor<SalaryRecord> captor = ArgumentCaptor.forClass(SalaryRecord.class);
        verify(salaryRecordRepository).save(captor.capture());
        SalaryRecord saved = captor.getValue();
        assertEquals(5L, saved.getWorkerId());
        assertEquals("Ramesh Kumar", saved.getWorkerName());
        assertEquals(6, saved.getMonth());
        assertEquals(2026, saved.getYear());
        assertEquals(24, saved.getPresentDays());
        assertEquals(0, saved.getHalfDays());
        assertEquals(0, new BigDecimal("500.00").compareTo(saved.getWagePerDay()));
        // 24 * 500.00 = 12,000.00
        assertEquals(0, new BigDecimal("12000.00").compareTo(saved.getGrossSalary()));
    }

    @Test
    void proratesHalfDaysAtHalfWageInGrossSalary() {
        WorkerAttendanceReport attendance = WorkerAttendanceReport.builder()
                .workerId(5L)
                .month(6)
                .year(2026)
                .records(List.of(AttendanceResponse.builder().workerId(5L).jobId(10L).build()))
                .summary(AttendanceSummary.builder().presentDays(24).halfDays(2).build())
                .build();
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026)).thenReturn(attendance);
        when(jobServiceClient.getJobPost(10L)).thenReturn(
                JobPostResponse.builder().wagePerDay(new BigDecimal("500.00")).build());
        when(salarySlipPdfGenerator.generate(any(SalaryRecord.class)))
                .thenReturn(new byte[]{'%', 'P', 'D', 'F'});

        payrollService.generateSalarySlip(5L, 6, 2026, "Ramesh Kumar");

        ArgumentCaptor<SalaryRecord> captor = ArgumentCaptor.forClass(SalaryRecord.class);
        verify(salaryRecordRepository).save(captor.capture());
        SalaryRecord saved = captor.getValue();
        assertEquals(24, saved.getPresentDays());
        assertEquals(2, saved.getHalfDays());
        // 24 + 2 * 0.5 = 25 paid days => 25 * 500.00 = 12,500.00
        assertEquals(0, new BigDecimal("12500.00").compareTo(saved.getGrossSalary()));
    }

    @Test
    void proratesOddHalfDayCountAsHalfPaidDay() {
        WorkerAttendanceReport attendance = WorkerAttendanceReport.builder()
                .records(List.of(AttendanceResponse.builder().jobId(10L).build()))
                .summary(AttendanceSummary.builder().presentDays(24).halfDays(1).build())
                .build();
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026)).thenReturn(attendance);
        when(jobServiceClient.getJobPost(10L)).thenReturn(
                JobPostResponse.builder().wagePerDay(new BigDecimal("500.00")).build());
        when(salarySlipPdfGenerator.generate(any(SalaryRecord.class)))
                .thenReturn(new byte[]{'%', 'P', 'D', 'F'});

        payrollService.generateSalarySlip(5L, 6, 2026, "Ramesh Kumar");

        ArgumentCaptor<SalaryRecord> captor = ArgumentCaptor.forClass(SalaryRecord.class);
        verify(salaryRecordRepository).save(captor.capture());
        // 24 + 1 * 0.5 = 24.5 paid days => 24.5 * 500.00 = 12,250.00
        assertEquals(0, new BigDecimal("12250.00")
                .compareTo(captor.getValue().getGrossSalary()));
    }

    @Test
    void fallsBackToDefaultWorkerNameWhenNotProvided() {
        WorkerAttendanceReport attendance = WorkerAttendanceReport.builder()
                .records(List.of(AttendanceResponse.builder().jobId(10L).build()))
                .summary(AttendanceSummary.builder().presentDays(10).build())
                .build();
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026)).thenReturn(attendance);
        when(jobServiceClient.getJobPost(10L)).thenReturn(
                JobPostResponse.builder().wagePerDay(new BigDecimal("400.00")).build());
        when(salarySlipPdfGenerator.generate(any(SalaryRecord.class)))
                .thenReturn(new byte[]{'%', 'P', 'D', 'F'});

        payrollService.generateSalarySlip(5L, 6, 2026, null);

        ArgumentCaptor<SalaryRecord> captor = ArgumentCaptor.forClass(SalaryRecord.class);
        verify(salaryRecordRepository).save(captor.capture());
        assertEquals("Worker 5", captor.getValue().getWorkerName());
    }

    @Test
    void throwsWhenWorkerHasNoAttendanceRecords() {
        WorkerAttendanceReport empty = WorkerAttendanceReport.builder()
                .records(List.of())
                .summary(AttendanceSummary.builder().presentDays(0).build())
                .build();
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026)).thenReturn(empty);

        assertThrows(ResourceNotFoundException.class,
                () -> payrollService.generateSalarySlip(5L, 6, 2026, null));

        verifyNoInteractions(jobServiceClient, salaryRecordRepository, salarySlipPdfGenerator);
    }

    @Test
    void returnsSalaryHistoryFilteredByPeriod() {
        SalaryRecord record = SalaryRecord.builder()
                .id(1L)
                .workerId(5L)
                .workerName("Ramesh Kumar")
                .month(6)
                .year(2026)
                .presentDays(24)
                .wagePerDay(new BigDecimal("500.00"))
                .grossSalary(new BigDecimal("12000.00"))
                .generatedAt(LocalDateTime.of(2026, 7, 1, 10, 0))
                .build();
        when(salaryRecordRepository
                .findByWorkerIdAndMonthAndYearOrderByGeneratedAtDesc(5L, 6, 2026))
                .thenReturn(List.of(record));

        List<SalaryRecordResponse> history = payrollService.getSalaryHistory(5L, 6, 2026);

        assertEquals(1, history.size());
        assertEquals(5L, history.get(0).getWorkerId());
        assertEquals(0, new BigDecimal("12000.00").compareTo(history.get(0).getGrossSalary()));
    }

    @Test
    void generatesBatchSlipsForAllWorkersWithAttendance() {
        when(attendanceServiceClient.getWorkerIdsWithAttendance(6, 2026))
                .thenReturn(List.of(5L, 9L));
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026))
                .thenReturn(report(5L, 10L, 24, 2));
        when(jobServiceClient.getJobPost(10L))
                .thenReturn(JobPostResponse.builder().wagePerDay(new BigDecimal("500.00")).build());
        when(attendanceServiceClient.getWorkerAttendance(9L, 6, 2026))
                .thenReturn(report(9L, 11L, 20, 0));
        when(jobServiceClient.getJobPost(11L))
                .thenReturn(JobPostResponse.builder().wagePerDay(new BigDecimal("600.00")).build());
        when(salarySlipPdfGenerator.generate(any(SalaryRecord.class)))
                .thenReturn(new byte[]{'%', 'P', 'D', 'F'});

        List<SalarySlip> slips = payrollService.generateBatchSalarySlips(6, 2026);

        assertEquals(2, slips.size());
        assertEquals("salary-slip-5-6-2026.pdf", slips.get(0).filename());
        assertEquals("salary-slip-9-6-2026.pdf", slips.get(1).filename());
        verify(salaryRecordRepository, times(2)).save(any(SalaryRecord.class));
    }

    @Test
    void throwsWhenNoWorkersHaveAttendanceForBatch() {
        when(attendanceServiceClient.getWorkerIdsWithAttendance(6, 2026))
                .thenReturn(List.of());

        assertThrows(ResourceNotFoundException.class,
                () -> payrollService.generateBatchSalarySlips(6, 2026));

        verifyNoInteractions(jobServiceClient, salaryRecordRepository, salarySlipPdfGenerator);
    }

    @Test
    void exportsSalaryHistoryAsCsv() {
        SalaryRecord record = SalaryRecord.builder()
                .id(1L)
                .workerId(5L)
                .workerName("Ramesh, Kumar")
                .month(6)
                .year(2026)
                .presentDays(24)
                .halfDays(2)
                .wagePerDay(new BigDecimal("500.00"))
                .grossSalary(new BigDecimal("12500.00"))
                .generatedAt(LocalDateTime.of(2026, 7, 1, 10, 0))
                .build();
        when(salaryRecordRepository.findByWorkerIdAndMonthAndYearOrderByGeneratedAtDesc(5L, 6, 2026))
                .thenReturn(List.of(record));

        CsvExport csv = payrollService.exportHistoryCsv(5L, 6, 2026);

        assertEquals("salary-history-5-6-2026.csv", csv.filename());
        assertThat(csv.content())
                .contains("ID,Worker ID,Worker Name,Month,Year,Present Days,Half Days,")
                .contains("1,5,\"Ramesh, Kumar\",6,2026,24,2,500.00,12500.00,2026-07-01T10:00");
    }

    @Test
    void batchSkipsFailedWorkersAndReturnsSuccessfulSlips() {
        when(attendanceServiceClient.getWorkerIdsWithAttendance(6, 2026))
                .thenReturn(List.of(5L, 9L));
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026))
                .thenReturn(report(5L, 10L, 24, 2));
        when(jobServiceClient.getJobPost(10L))
                .thenReturn(JobPostResponse.builder().wagePerDay(new BigDecimal("500.00")).build());
        // worker 9 has no attendance record -> generateSalarySlip throws, must be skipped
        when(attendanceServiceClient.getWorkerAttendance(9L, 6, 2026))
                .thenReturn(WorkerAttendanceReport.builder()
                        .records(List.of())
                        .summary(AttendanceSummary.builder().presentDays(0).build())
                        .build());
        when(salarySlipPdfGenerator.generate(any(SalaryRecord.class)))
                .thenReturn(new byte[]{'%', 'P', 'D', 'F'});

        List<SalarySlip> slips = payrollService.generateBatchSalarySlips(6, 2026);

        assertEquals(1, slips.size());
        assertEquals("salary-slip-5-6-2026.pdf", slips.get(0).filename());
        verify(salaryRecordRepository, times(1)).save(any(SalaryRecord.class));
    }

    @Test
    void exportsEmptyHistoryAsHeaderOnlyCsv() {
        when(salaryRecordRepository.findByWorkerIdOrderByGeneratedAtDesc(5L))
                .thenReturn(List.of());

        CsvExport csv = payrollService.exportHistoryCsv(5L, null, null);

        assertEquals("salary-history-5.csv", csv.filename());
        assertThat(csv.content()).startsWith("ID,Worker ID,Worker Name,").endsWith("\r\n");
    }

    @Test
    void escapesSpreadsheetFormulaInjectionInCsv() {
        SalaryRecord record = SalaryRecord.builder()
                .id(1L)
                .workerId(5L)
                .workerName("=SUM(A1:A9)")
                .month(6)
                .year(2026)
                .presentDays(24)
                .halfDays(0)
                .wagePerDay(new BigDecimal("500.00"))
                .grossSalary(new BigDecimal("12000.00"))
                .build();
        when(salaryRecordRepository.findByWorkerIdAndMonthAndYearOrderByGeneratedAtDesc(5L, 6, 2026))
                .thenReturn(List.of(record));

        CsvExport csv = payrollService.exportHistoryCsv(5L, 6, 2026);

        assertThat(csv.content()).contains("1,5,'=SUM(A1:A9),6,2026,24,0,500.00,12000.00,");
    }

    @Test
    void rejectsInvalidMonthBeforeAnyUpstreamCall() {
        assertThrows(IllegalArgumentException.class,
                () -> payrollService.generateSalarySlip(5L, 13, 2026, null));

        verifyNoInteractions(attendanceServiceClient, jobServiceClient,
                salaryRecordRepository, salarySlipPdfGenerator);
    }

    private WorkerAttendanceReport report(Long workerId, Long jobId, int present, int half) {
        return WorkerAttendanceReport.builder()
                .records(List.of(AttendanceResponse.builder()
                        .workerId(workerId).jobId(jobId).build()))
                .summary(AttendanceSummary.builder().presentDays(present).halfDays(half).build())
                .build();
    }
}
