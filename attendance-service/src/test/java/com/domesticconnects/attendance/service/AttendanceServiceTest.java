package com.domesticconnects.attendance.service;

import com.domesticconnects.attendance.dto.AttendanceRequest;
import com.domesticconnects.attendance.dto.AttendanceResponse;
import com.domesticconnects.attendance.dto.AttendanceSummary;
import com.domesticconnects.attendance.dto.WorkerAttendanceReport;
import com.domesticconnects.attendance.entity.Attendance;
import com.domesticconnects.attendance.entity.AttendanceStatus;
import com.domesticconnects.attendance.exception.DuplicateAttendanceException;
import com.domesticconnects.attendance.repository.AttendanceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AttendanceService")
class AttendanceServiceTest {

    @Mock
    private AttendanceRepository attendanceRepository;

    @InjectMocks
    private AttendanceService attendanceService;

    private AttendanceRequest request(LocalDate date, AttendanceStatus status) {
        AttendanceRequest request = new AttendanceRequest();
        request.setWorkerId(10L);
        request.setJobId(1L);
        request.setDate(date);
        request.setStatus(status);
        return request;
    }

    @Test
    @DisplayName("markAttendance should save and return the created record")
    void markAttendance_savesAndReturnsRecord() {
        LocalDate date = LocalDate.of(2026, 8, 3);
        when(attendanceRepository.existsByWorkerIdAndDate(10L, date)).thenReturn(false);

        Attendance saved = Attendance.builder()
                .id(1L)
                .workerId(10L)
                .jobId(1L)
                .date(date)
                .status(AttendanceStatus.PRESENT)
                .build();
        when(attendanceRepository.save(any(Attendance.class))).thenReturn(saved);

        AttendanceResponse response = attendanceService.markAttendance(request(date, AttendanceStatus.PRESENT));

        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getWorkerId()).isEqualTo(10L);
        assertThat(response.getStatus()).isEqualTo(AttendanceStatus.PRESENT);
        verify(attendanceRepository).save(any(Attendance.class));
    }

    @Test
    @DisplayName("markAttendance should reject a duplicate for the same worker and date")
    void markAttendance_rejectsDuplicate() {
        LocalDate date = LocalDate.of(2026, 8, 3);
        when(attendanceRepository.existsByWorkerIdAndDate(10L, date)).thenReturn(true);

        assertThatThrownBy(() ->
                attendanceService.markAttendance(request(date, AttendanceStatus.PRESENT)))
                .isInstanceOf(DuplicateAttendanceException.class)
                .hasMessageContaining("already marked");

        verify(attendanceRepository, never()).save(any(Attendance.class));
    }

    @Test
    @DisplayName("getWorkerAttendance should return records and a summary with correct counts")
    void getWorkerAttendance_returnsRecordsAndSummary() {
        Long workerId = 10L;
        List<Attendance> records = List.of(
                Attendance.builder().id(1L).workerId(workerId).jobId(1L)
                        .date(LocalDate.of(2026, 8, 1)).status(AttendanceStatus.PRESENT).build(),
                Attendance.builder().id(2L).workerId(workerId).jobId(1L)
                        .date(LocalDate.of(2026, 8, 5)).status(AttendanceStatus.ABSENT).build(),
                Attendance.builder().id(3L).workerId(workerId).jobId(1L)
                        .date(LocalDate.of(2026, 8, 10)).status(AttendanceStatus.HALF_DAY).build());
        when(attendanceRepository.findByWorkerIdAndDateBetweenOrderByDateAsc(
                workerId, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31)))
                .thenReturn(records);

        WorkerAttendanceReport report = attendanceService.getWorkerAttendance(workerId, 8, 2026);

        assertThat(report.getMonth()).isEqualTo(8);
        assertThat(report.getYear()).isEqualTo(2026);
        assertThat(report.getRecords()).hasSize(3);

        AttendanceSummary summary = report.getSummary();
        assertThat(summary.getPresentDays()).isEqualTo(1);
        assertThat(summary.getAbsentDays()).isEqualTo(1);
        assertThat(summary.getHalfDays()).isEqualTo(1);
        assertThat(summary.getTotalDays()).isEqualTo(3);
    }

    @Test
    @DisplayName("getWorkerAttendance should reject an invalid month")
    void getWorkerAttendance_rejectsInvalidMonth() {
        assertThatThrownBy(() -> attendanceService.getWorkerAttendance(10L, 13, 2026))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("between 1 and 12");
    }
}
