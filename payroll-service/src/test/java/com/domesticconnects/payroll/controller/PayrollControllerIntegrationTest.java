package com.domesticconnects.payroll.controller;

import com.domesticconnects.payroll.client.AttendanceServiceClient;
import com.domesticconnects.payroll.client.JobServiceClient;
import com.domesticconnects.payroll.dto.AttendanceResponse;
import com.domesticconnects.payroll.dto.AttendanceSummary;
import com.domesticconnects.payroll.dto.JobPostResponse;
import com.domesticconnects.payroll.dto.WorkerAttendanceReport;
import com.domesticconnects.payroll.entity.SalaryRecord;
import feign.FeignException;
import feign.Request;
import feign.Response;
import com.domesticconnects.payroll.config.KafkaTestConfig;
import com.domesticconnects.payroll.repository.SalaryRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Boots the full payroll-service context (H2 via the test application.yml,
 * Eureka/config disabled) with the two OpenFeign clients mocked. Exercises the
 * real controller -> service -> OpenPDF generator -> repository pipeline and
 * asserts the salary-slip endpoint's HTTP headers and PDF bytes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(KafkaTestConfig.class)
@DisplayName("PayrollController integration")
class PayrollControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SalaryRecordRepository salaryRecordRepository;

    @MockBean
    private AttendanceServiceClient attendanceServiceClient;

    @MockBean
    private JobServiceClient jobServiceClient;

    /**
     * Uses a dedicated in-memory database so this full-context test never shares
     * {@code jdbc:h2:mem:testdb} with the module's {@code @DataJpaTest} contexts
     * (each cached context runs its own {@code create-drop}, which could otherwise
     * wipe the other's tables mid-run).
     */
    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () ->
                "jdbc:h2:mem:payroll-it;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE");
    }

    @BeforeEach
    void setUp() {
        salaryRecordRepository.deleteAll();
    }

    @Test
    @DisplayName("slip endpoint returns a valid PDF with the right headers and persists history")
    void slipEndpoint_returnsPdfWithCorrectHeadersAndBytes() throws Exception {
        stubUpstreams();

        MvcResult result = mockMvc.perform(get("/payroll/5/slip")
                        .param("month", "6")
                        .param("year", "2026")
                        .param("workerName", "Ramesh Kumar")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"salary-slip-5-6-2026.pdf\""))
                .andExpect(header().exists(HttpHeaders.CONTENT_LENGTH))
                .andReturn();

        // Real PDF bytes produced by the OpenPDF generator
        byte[] pdf = result.getResponse().getContentAsByteArray();
        assertTrue(pdf.length > 500, "PDF body should be non-trivial in size");
        assertArrayEquals("%PDF".getBytes(StandardCharsets.ISO_8859_1),
                Arrays.copyOfRange(pdf, 0, 4), "PDF body should start with the %PDF header");

        // The generated slip was persisted to history (real H2 repository)
        List<SalaryRecord> saved = salaryRecordRepository
                .findByWorkerIdAndMonthAndYearOrderByGeneratedAtDesc(5L, 6, 2026);
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getWorkerName()).isEqualTo("Ramesh Kumar");
        assertThat(saved.get(0).getPresentDays()).isEqualTo(24);
        assertThat(saved.get(0).getHalfDays()).isEqualTo(2);
        assertThat(saved.get(0).getGrossSalary()).isEqualByComparingTo(new BigDecimal("12500.00"));
    }

    @Test
    @DisplayName("slip endpoint rejects callers without an allowed role")
    void slipEndpoint_rejectsMissingRole() throws Exception {
        mockMvc.perform(get("/payroll/5/slip")
                        .param("month", "6")
                        .param("year", "2026"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("slip endpoint returns 404 when the worker has no attendance records")
    void slipEndpoint_returns404WhenNoAttendance() throws Exception {
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026))
                .thenReturn(WorkerAttendanceReport.builder().records(List.of()).build());

        mockMvc.perform(get("/payroll/5/slip")
                        .param("month", "6")
                        .param("year", "2026")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("history export endpoint returns a CSV with the right headers and content")
    void csvExportEndpoint_returnsCsvWithCorrectHeadersAndContent() throws Exception {
        salaryRecordRepository.save(SalaryRecord.builder()
                .workerId(5L)
                .workerName("Ramesh Kumar")
                .month(6)
                .year(2026)
                .presentDays(24)
                .halfDays(2)
                .wagePerDay(new BigDecimal("500.00"))
                .grossSalary(new BigDecimal("12500.00"))
                .build());

        MvcResult result = mockMvc.perform(get("/payroll/5/history/export")
                        .param("month", "6")
                        .param("year", "2026")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.parseMediaType("text/csv")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"salary-history-5-6-2026.csv\""))
                .andExpect(header().exists(HttpHeaders.CONTENT_LENGTH))
                .andReturn();

        String csv = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv)
                .startsWith("ID,Worker ID,Worker Name,")
                .contains("5,Ramesh Kumar,6,2026,24,2,500.00,12500.00,");
    }

    @Test
    @DisplayName("batch slips endpoint returns a ZIP archive containing one PDF per worker")
    void batchSlipsEndpoint_returnsZipWithPdfEntries() throws Exception {
        when(attendanceServiceClient.getWorkerIdsWithAttendance(6, 2026))
                .thenReturn(List.of(5L, 9L));
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026))
                .thenReturn(report(5L, 10L, 24, 2));
        when(jobServiceClient.getJobPost(10L)).thenReturn(job("500.00"));
        when(attendanceServiceClient.getWorkerAttendance(9L, 6, 2026))
                .thenReturn(report(9L, 11L, 20, 0));
        when(jobServiceClient.getJobPost(11L)).thenReturn(job("600.00"));

        MvcResult result = mockMvc.perform(get("/payroll/batch/slips")
                        .param("month", "6")
                        .param("year", "2026")
                        .header("X-User-Role", "EMPLOYER"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.parseMediaType("application/zip")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"salary-slips-6-2026.zip\""))
                .andExpect(header().exists(HttpHeaders.CONTENT_LENGTH))
                .andReturn();

        // Each ZIP entry must be a real PDF produced by the OpenPDF generator
        Map<String, byte[]> entries = unzip(result.getResponse().getContentAsByteArray());
        assertThat(entries.keySet()).containsExactly(
                "salary-slip-5-6-2026.pdf", "salary-slip-9-6-2026.pdf");
        for (byte[] pdf : entries.values()) {
            assertThat(pdf.length).isGreaterThan(500);
            assertThat(new String(Arrays.copyOfRange(pdf, 0, 4), StandardCharsets.ISO_8859_1))
                    .startsWith("%PDF");
        }
    }

    @Test
    @DisplayName("unknown paths return 404 (not 500)")
    void unknownPath_returns404() throws Exception {
        mockMvc.perform(get("/payroll/definitely-not-a-route"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("non-numeric worker id returns 400 (not 500)")
    void nonNumericWorkerId_returns400() throws Exception {
        mockMvc.perform(get("/payroll/abc/slip")
                        .param("month", "6")
                        .param("year", "2026")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("slip endpoint returns 400 for an invalid month")
    void slipEndpoint_returns400ForInvalidMonth() throws Exception {
        mockMvc.perform(get("/payroll/5/slip")
                        .param("month", "13")
                        .param("year", "2026")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Month must be between 1 and 12"));

        // The month is validated before any upstream call is made
        verifyNoInteractions(attendanceServiceClient, jobServiceClient);
    }

    @Test
    @DisplayName("slip endpoint returns 502 when job-service fails")
    void slipEndpoint_returns502WhenJobServiceErrors() throws Exception {
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026))
                .thenReturn(report(5L, 10L, 24, 2));
        when(jobServiceClient.getJobPost(10L)).thenThrow(feignError(500));

        mockMvc.perform(get("/payroll/5/slip")
                        .param("month", "6")
                        .param("year", "2026")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.success").value(false));
    }

    private void stubUpstreams() {
        when(attendanceServiceClient.getWorkerAttendance(5L, 6, 2026))
                .thenReturn(report(5L, 10L, 24, 2));
        when(jobServiceClient.getJobPost(10L)).thenReturn(job("500.00"));
    }

    /**
     * Builds a monthly attendance report. All call sites in this class exercise
     * the 6/2026 period, so month/year are intentionally fixed here.
     */
    private WorkerAttendanceReport report(Long workerId, Long jobId, int present, int half) {
        return WorkerAttendanceReport.builder()
                .workerId(workerId)
                .month(6)
                .year(2026)
                .records(List.of(AttendanceResponse.builder()
                        .workerId(workerId).jobId(jobId).build()))
                .summary(AttendanceSummary.builder().presentDays(present).halfDays(half).build())
                .build();
    }

    private JobPostResponse job(String wage) {
        return JobPostResponse.builder().wagePerDay(new BigDecimal(wage)).build();
    }

    /**
     * Builds a {@link FeignException} equivalent to the given upstream HTTP
     * status (e.g. 500 -> {@code FeignException.InternalServerError}), which the
     * global handler maps to 502 Bad Gateway.
     */
    private FeignException feignError(int status) {
        Response response = Response.builder()
                .status(status)
                .reason("Upstream error")
                .headers(Collections.emptyMap())
                .body(new byte[0])
                .request(Request.create(Request.HttpMethod.GET, "http://job-service/jobs/10",
                        Collections.emptyMap(), new byte[0], StandardCharsets.UTF_8))
                .build();
        return FeignException.errorStatus("getJobPost", response);
    }

    private Map<String, byte[]> unzip(byte[] bytes) throws Exception {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entries.put(entry.getName(), zip.readAllBytes());
            }
        }
        return entries;
    }
}
