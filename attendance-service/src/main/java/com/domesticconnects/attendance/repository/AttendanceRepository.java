package com.domesticconnects.attendance.repository;

import com.domesticconnects.attendance.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * Repository for {@link Attendance}.
 */
@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    /**
     * True when the worker already has an attendance record for the given date.
     * Used to prevent duplicate marking.
     */
    boolean existsByWorkerIdAndDate(Long workerId, LocalDate date);

    /**
     * All attendance records for a worker within a date range (inclusive),
     * ordered chronologically.
     */
    List<Attendance> findByWorkerIdAndDateBetweenOrderByDateAsc(
            Long workerId, LocalDate start, LocalDate end);

    /**
     * Distinct worker ids with at least one attendance record in the date range
     * (inclusive), ordered by worker id. Consumed by payroll-service to know
     * which workers to generate batch salary slips for.
     */
    @Query("SELECT DISTINCT a.workerId FROM Attendance a "
            + "WHERE a.date BETWEEN :start AND :end ORDER BY a.workerId")
    List<Long> findDistinctWorkerIdsByDateBetween(@Param("start") LocalDate start,
                                                  @Param("end") LocalDate end);
}
