package com.domesticconnects.payroll.repository;

import com.domesticconnects.payroll.entity.SalaryRecord;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@DisplayName("SalaryRecordRepository")
class SalaryRecordRepositoryTest {

    @Autowired
    private SalaryRecordRepository salaryRecordRepository;

    private SalaryRecord createRecord(int month, int year) {
        return SalaryRecord.builder()
                .workerId(5L)
                .workerName("Ramesh Kumar")
                .month(month)
                .year(year)
                .presentDays(24)
                .halfDays(2)
                .wagePerDay(new BigDecimal("500.00"))
                .grossSalary(new BigDecimal("12500.00"))
                .build();
    }

    @Test
    @DisplayName("findByWorkerIdAndMonthAndYear should filter by worker and period")
    void findByWorkerIdAndMonthAndYear_filtersByWorkerAndPeriod() {
        salaryRecordRepository.save(createRecord(6, 2026));
        salaryRecordRepository.save(createRecord(7, 2026));

        List<SalaryRecord> result = salaryRecordRepository
                .findByWorkerIdAndMonthAndYearOrderByGeneratedAtDesc(5L, 6, 2026);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMonth()).isEqualTo(6);
        assertThat(result.get(0).getYear()).isEqualTo(2026);
        assertThat(result.get(0).getGrossSalary())
                .isEqualByComparingTo(new BigDecimal("12500.00"));
        assertThat(result.get(0).getGeneratedAt()).isNotNull();
    }
}
