package com.domesticconnects.payroll.controller;

import com.domesticconnects.payroll.dto.ApiResponse;
import com.domesticconnects.payroll.dto.CsvExport;
import com.domesticconnects.payroll.dto.SalaryRecordResponse;
import com.domesticconnects.payroll.dto.SalarySlip;
import com.domesticconnects.payroll.exception.AccessDeniedException;
import com.domesticconnects.payroll.service.PayrollService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Payroll endpoints. Authentication is performed by the API gateway, which
 * forwards the caller's role in the {@code X-User-Role} header (see the
 * {@code JwtAuthGlobalFilter}). Role checks below are applied against that
 * header — no Spring Security filter chain exists in this service.
 */
@RestController
@RequestMapping("/payroll")
@RequiredArgsConstructor
public class PayrollController {

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_EMPLOYER = "EMPLOYER";
    private static final String ROLE_WORKER = "WORKER";

    private final PayrollService payrollService;

    /**
     * Returns a monthly salary slip as a PDF download.
     *
     * @param workerId   the worker the slip is generated for
     * @param month      1-12
     * @param year       e.g. 2026
     * @param workerName optional display name rendered on the slip
     */
    @GetMapping("/{workerId}/slip")
    public ResponseEntity<byte[]> getSalarySlip(@PathVariable Long workerId,
                                                @RequestParam int month,
                                                @RequestParam int year,
                                                @RequestParam(required = false) String workerName,
                                                HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER, ROLE_WORKER);

        SalarySlip slip = payrollService.generateSalarySlip(workerId, month, year, workerName);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + slip.filename() + "\"")
                .contentLength(slip.pdfBytes().length)
                .body(slip.pdfBytes());
    }

    /**
     * Returns the worker's persisted payroll history, optionally filtered by
     * month/year.
     */
    @GetMapping("/{workerId}/history")
    public ResponseEntity<ApiResponse<List<SalaryRecordResponse>>> getSalaryHistory(
            @PathVariable Long workerId,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER, ROLE_WORKER);

        List<SalaryRecordResponse> history = payrollService.getSalaryHistory(workerId, month, year);
        return ResponseEntity.ok(ApiResponse.success("Salary history retrieved", history));
    }

    /**
     * Returns the worker's payroll history as a downloadable CSV file,
     * optionally filtered by month/year.
     */
    @GetMapping("/{workerId}/history/export")
    public ResponseEntity<byte[]> exportSalaryHistory(@PathVariable Long workerId,
                                                      @RequestParam(required = false) Integer month,
                                                      @RequestParam(required = false) Integer year,
                                                      HttpServletRequest httpRequest) {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER, ROLE_WORKER);

        CsvExport csv = payrollService.exportHistoryCsv(workerId, month, year);
        byte[] bytes = csv.content().getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + csv.filename() + "\"")
                .contentLength(bytes.length)
                .body(bytes);
    }

    /**
     * Generates a payslip for every worker with attendance in the given
     * month/year and returns all PDFs in a single ZIP archive.
     */
    @GetMapping("/batch/slips")
    public ResponseEntity<byte[]> generateBatchSlips(@RequestParam int month,
                                                     @RequestParam int year,
                                                     HttpServletRequest httpRequest)
            throws IOException {
        requireRole(httpRequest, ROLE_ADMIN, ROLE_EMPLOYER);

        List<SalarySlip> slips = payrollService.generateBatchSalarySlips(month, year);
        byte[] zip = buildZip(slips);
        String filename = "salary-slips-" + month + "-" + year + ".zip";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .contentLength(zip.length)
                .body(zip);
    }

    /**
     * Bundles individual salary-slip PDFs into a single ZIP archive.
     */
    private byte[] buildZip(List<SalarySlip> slips) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (SalarySlip slip : slips) {
                zip.putNextEntry(new ZipEntry(slip.filename()));
                zip.write(slip.pdfBytes());
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    /**
     * Verifies the caller's role (from the gateway-forwarded header) against
     * the allowed roles. Throws {@link AccessDeniedException} (HTTP 403) when
     * the role is missing or not permitted.
     */
    private void requireRole(HttpServletRequest request, String... allowedRoles) {
        String role = extractUserRole(request);
        for (String allowedRole : allowedRoles) {
            if (role.equalsIgnoreCase(allowedRole)) {
                return;
            }
        }
        throw new AccessDeniedException(
                "Access denied: requires one of roles " + Arrays.toString(allowedRoles));
    }

    /**
     * Reads the caller's role. The gateway forwards it as {@code X-User-Role};
     * {@code X-User-Roles} is tolerated as a fallback for older gateway builds.
     * A missing header yields an empty string so the caller is treated as
     * unauthenticated.
     */
    private String extractUserRole(HttpServletRequest request) {
        String role = request.getHeader("X-User-Role");
        if (role == null || role.isBlank()) {
            role = request.getHeader("X-User-Roles");
        }
        return role == null ? "" : role.trim();
    }
}
