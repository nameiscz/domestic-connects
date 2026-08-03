package com.domesticconnects.payroll.dto;

/**
 * Result of a salary-slip generation: the raw PDF bytes and the suggested
 * download filename.
 */
public record SalarySlip(byte[] pdfBytes, String filename) {
}
