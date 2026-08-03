package com.domesticconnects.payroll.dto;

/**
 * Result of a salary-history CSV export: the CSV text and the suggested
 * download filename.
 */
public record CsvExport(String content, String filename) {
}
