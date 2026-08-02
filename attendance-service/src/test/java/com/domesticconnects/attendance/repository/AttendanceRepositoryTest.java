package com.domesticconnects.attendance.repository;

import com.domesticconnects.attendance.entity.Attendance;
import com.domesticconnects.attendance.entity.AttendanceStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@DisplayName("AttendanceRepository")
class AttendanceRepositoryTest {

    @Autowired
    private AttendanceRepository attendanceRepository;

    private Attendance createAttendance(Long workerId, LocalDate date, AttendanceStatus status) {
        return Attendance.builder()
                .workerId(workerId)
                .jobId(1L)
                .date(date)
                .status(status)
                .build();
    }

    @Test
    @DisplayName("existsByWorkerIdAndDate should detect an existing record")
    void existsByWorkerIdAndDate_detectsExistingRecord() {
        LocalDate date = LocalDate.of(2026, 8, 3);
        attendanceRepository.save(createAttendance(10L, date, AttendanceStatus.PRESENT));

        assertThat(attendanceRepository.existsByWorkerIdAndDate(10L, date)).isTrue();
        assertThat(attendanceRepository.existsByWorkerIdAndDate(10L, date.plusDays(1))).isFalse();
        assertThat(attendanceRepository.existsByWorkerIdAndDate(11L, date)).isFalse();
    }

    @Test
    @DisplayName("findByWorkerIdAndDateBetween should return only matching records ordered by date")
    void findByWorkerIdAndDateBetween_filtersAndOrders() {
        attendanceRepository.save(createAttendance(10L, LocalDate.of(2026, 8, 1), AttendanceStatus.PRESENT));
        attendanceRepository.save(createAttendance(10L, LocalDate.of(2026, 8, 15), AttendanceStatus.HALF_DAY));
        attendanceRepository.save(createAttendance(10L, LocalDate.of(2026, 9, 1), AttendanceStatus.ABSENT));
        attendanceRepository.save(createAttendance(11L, LocalDate.of(2026, 8, 20), AttendanceStatus.PRESENT));

        List<Attendance> result = attendanceRepository.findByWorkerIdAndDateBetweenOrderByDateAsc(
                10L, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31));

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(result.get(1).getDate()).isEqualTo(LocalDate.of(2026, 8, 15));
    }

    @Test
    @DisplayName("unique constraint should reject a second record for the same worker and date")
    void uniqueConstraint_rejectsDuplicateWorkerDate() {
        LocalDate date = LocalDate.of(2026, 8, 3);
        attendanceRepository.save(createAttendance(10L, date, AttendanceStatus.PRESENT));

        assertThatThrownBy(() ->
                attendanceRepository.saveAndFlush(
                        createAttendance(10L, date, AttendanceStatus.ABSENT)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
