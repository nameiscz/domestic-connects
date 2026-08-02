package com.domesticconnects.attendance.service;

import com.domesticconnects.attendance.dto.AttendanceRequest;
import com.domesticconnects.attendance.dto.AttendanceResponse;
import com.domesticconnects.attendance.dto.AttendanceSummary;
import com.domesticconnects.attendance.dto.WorkerAttendanceReport;
import com.domesticconnects.attendance.entity.Attendance;
import com.domesticconnects.attendance.entity.AttendanceStatus;
import com.domesticconnects.attendance.exception.DuplicateAttendanceException;
import com.domesticconnects.attendance.repository.AttendanceRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceService.class);

    private final AttendanceRepository attendanceRepository;

    /**
     * Marks a worker's attendance for a date. Duplicate markings for the same
     * worker + date are rejected with {@link DuplicateAttendanceException}.
     * The database unique constraint {@code uk_attendance_worker_date} is a
     * second line of defence against concurrent requests.
     */
    @Transactional
    public AttendanceResponse markAttendance(AttendanceRequest request) {
        if (attendanceRepository.existsByWorkerIdAndDate(request.getWorkerId(), request.getDate())) {
            throw new DuplicateAttendanceException(
                    duplicateMessage(request.getWorkerId(), request.getDate()));
        }

        Attendance attendance = Attendance.builder()
                .workerId(request.getWorkerId())
                .jobId(request.getJobId())
                .date(request.getDate())
                .status(request.getStatus())
                .build();

        try {
            attendance = attendanceRepository.save(attendance);
        } catch (DataIntegrityViolationException e) {
            log.warn("Duplicate attendance insert blocked for worker {} on {}",
                    request.getWorkerId(), request.getDate());
            throw new DuplicateAttendanceException(
                    duplicateMessage(request.getWorkerId(), request.getDate()));
        }

        log.info("Attendance marked for worker {} on {} as {}",
                attendance.getWorkerId(), attendance.getDate(), attendance.getStatus());
        return toResponse(attendance);
    }

    /**
     * Returns a worker's attendance records for a given month/year together
     * with a summary. When {@code month} or {@code year} is omitted, the
     * current month/year is used.
     */
    @Transactional(readOnly = true)
    public WorkerAttendanceReport getWorkerAttendance(Long workerId, Integer month, Integer year) {
        YearMonth yearMonth = resolveYearMonth(month, year);

        List<Attendance> records = attendanceRepository
                .findByWorkerIdAndDateBetweenOrderByDateAsc(
                        workerId, yearMonth.atDay(1), yearMonth.atEndOfMonth());

        List<AttendanceResponse> responses = records.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return WorkerAttendanceReport.builder()
                .workerId(workerId)
                .month(yearMonth.getMonthValue())
                .year(yearMonth.getYear())
                .records(responses)
                .summary(buildSummary(workerId, yearMonth, records))
                .build();
    }

    /**
     * Resolves the requested period. Either parameter may be omitted; when
     * omitted it falls back to the current month/year.
     */
    private YearMonth resolveYearMonth(Integer month, Integer year) {
        YearMonth now = YearMonth.now();
        int resolvedYear = year != null ? year : now.getYear();
        int resolvedMonth = month != null ? month : now.getMonthValue();

        if (resolvedMonth < 1 || resolvedMonth > 12) {
            throw new IllegalArgumentException("Month must be between 1 and 12");
        }
        return YearMonth.of(resolvedYear, resolvedMonth);
    }

    private String duplicateMessage(Long workerId, LocalDate date) {
        return String.format("Attendance already marked for worker %d on %s", workerId, date);
    }

    private AttendanceSummary buildSummary(Long workerId, YearMonth yearMonth,
                                           List<Attendance> records) {
        long presentDays = records.stream()
                .filter(a -> a.getStatus() == AttendanceStatus.PRESENT)
                .count();
        long absentDays = records.stream()
                .filter(a -> a.getStatus() == AttendanceStatus.ABSENT)
                .count();
        long halfDays = records.stream()
                .filter(a -> a.getStatus() == AttendanceStatus.HALF_DAY)
                .count();

        return AttendanceSummary.builder()
                .workerId(workerId)
                .month(yearMonth.getMonthValue())
                .year(yearMonth.getYear())
                .presentDays(presentDays)
                .absentDays(absentDays)
                .halfDays(halfDays)
                .totalDays(records.size())
                .build();
    }

    private AttendanceResponse toResponse(Attendance attendance) {
        return AttendanceResponse.builder()
                .id(attendance.getId())
                .workerId(attendance.getWorkerId())
                .jobId(attendance.getJobId())
                .date(attendance.getDate())
                .status(attendance.getStatus())
                .createdAt(attendance.getCreatedAt())
                .build();
    }
}
