package com.domesticconnects.payroll.repository;

import com.domesticconnects.payroll.entity.SalaryRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for {@link SalaryRecord}.
 */
@Repository
public interface SalaryRecordRepository extends JpaRepository<SalaryRecord, Long> {

    /**
     * All payroll history for a worker, newest first.
     */
    List<SalaryRecord> findByWorkerIdOrderByGeneratedAtDesc(Long workerId);

    /**
     * Payroll history for a worker in a given month/year, newest first.
     */
    List<SalaryRecord> findByWorkerIdAndMonthAndYearOrderByGeneratedAtDesc(
            Long workerId, Integer month, Integer year);
}
