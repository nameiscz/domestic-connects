package com.domesticconnects.payroll.service;

import com.domesticconnects.payroll.entity.SalaryRecord;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

class SalarySlipPdfGeneratorTest {

    private final SalarySlipPdfGenerator generator = new SalarySlipPdfGenerator(
            "Domestic Connects",
            "123 Example Street, Hyderabad, Telangana 500001, India",
            "contact@domesticconnects.com | +91 98765 43210");

    @Test
    void generatesPdfWithLetterheadAndAllPayrollDetails() throws Exception {
        SalaryRecord record = SalaryRecord.builder()
                .workerId(5L)
                .workerName("Ramesh Kumar")
                .month(6)
                .year(2026)
                .presentDays(24)
                .halfDays(2)
                .wagePerDay(new BigDecimal("500.00"))
                .grossSalary(new BigDecimal("12500.00"))
                .build();

        byte[] pdf = generator.generate(record);
        String text = extractText(pdf);

        assertNotNull(pdf);
        assertTrue(pdf.length > 500, "PDF should be non-trivial in size");
        assertArrayEquals("%PDF".getBytes(StandardCharsets.ISO_8859_1),
                Arrays.copyOfRange(pdf, 0, 4), "PDF should start with the %PDF header");

        // Letterhead
        assertTrue(text.contains("Domestic Connects"));
        assertTrue(text.contains("123 Example Street"));
        // Title + period
        assertTrue(text.contains("SALARY SLIP"));
        assertTrue(text.contains("June 2026"));
        // Payroll details
        assertTrue(text.contains("Ramesh Kumar"));
        assertTrue(text.contains("Worker ID"));
        assertTrue(text.contains("Days Present"));
        assertTrue(text.contains("24"));
        assertTrue(text.contains("Half Days"));
        assertTrue(text.contains("Paid Days"));
        assertTrue(text.contains("25"));
        assertTrue(text.contains("500.00"));
        assertTrue(text.contains("12,500.00"));
    }

    @Test
    void treatsMissingHalfDaysAsZeroForLegacyRecords() throws Exception {
        SalaryRecord record = SalaryRecord.builder()
                .workerId(5L)
                .workerName("Ramesh Kumar")
                .month(6)
                .year(2026)
                .presentDays(24)
                .halfDays(null)
                .wagePerDay(new BigDecimal("500.00"))
                .grossSalary(new BigDecimal("12000.00"))
                .build();

        String text = extractText(generator.generate(record));

        assertTrue(text.contains("Half Days"));
        assertTrue(text.contains("Paid Days"));
        // paid days = 24 + 0 = 24, gross unchanged for legacy rows
        assertTrue(text.contains("12,000.00"));
    }

    /**
     * Reads and concatenates the text content of page 1 of the PDF.
     */
    private String extractText(byte[] pdf) throws Exception {
        PdfReader reader = null;
        try {
            reader = new PdfReader(pdf);
            return new PdfTextExtractor(reader).getTextFromPage(1);
        } finally {
            if (reader != null) {
                reader.close();
            }
        }
    }
}
