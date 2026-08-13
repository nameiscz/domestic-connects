package com.domesticconnects.performance.controller;

import com.domesticconnects.performance.dto.PerformanceReviewRequest;
import com.domesticconnects.performance.dto.PerformanceReviewUpdateRequest;
import com.domesticconnects.performance.entity.PerformanceReview;
import com.domesticconnects.performance.config.KafkaTestConfig;
import com.domesticconnects.performance.repository.PerformanceReviewRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Boots the full performance-service context (H2 via the test application.yml,
 * Eureka/config disabled) and exercises the real controller -> service ->
 * repository pipeline. Role checks are driven by the gateway-forwarded
 * {@code X-User-Role} header, matching how the API gateway calls this service.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(KafkaTestConfig.class)
@DisplayName("PerformanceReviewController integration")
class PerformanceReviewControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PerformanceReviewRepository performanceReviewRepository;

    /**
     * Uses a dedicated in-memory database so this full-context test never shares
     * {@code jdbc:h2:mem:testdb} with the module's {@code @DataJpaTest} contexts
     * (each cached context runs its own {@code create-drop}, which could otherwise
     * wipe the other's tables mid-run).
     */
    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () ->
                "jdbc:h2:mem:performance-it;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE");
    }

    @BeforeEach
    void setUp() {
        performanceReviewRepository.deleteAll();
    }

    private PerformanceReviewRequest validRequest() {
        PerformanceReviewRequest request = new PerformanceReviewRequest();
        request.setWorkerId(5L);
        request.setJobId(3L);
        request.setRating(4);
        request.setRemarks("Punctual and careful.");
        request.setReviewedBy("employer@example.com");
        return request;
    }

    private MockHttpServletRequestBuilder postReview(String role, PerformanceReviewRequest request)
            throws Exception {
        var builder = post("/performance/review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request));
        if (role != null) {
            builder.header("X-User-Role", role);
        }
        return builder;
    }

    // ------------------------------------------------------------------
    // POST /performance/review
    // ------------------------------------------------------------------

    @Test
    @DisplayName("should create a review (201) and persist it when called with an allowed role")
    void submitReview_createsAndPersists() throws Exception {
        mockMvc.perform(postReview("ADMIN", validRequest()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.workerId").value(5))
                .andExpect(jsonPath("$.jobId").value(3))
                .andExpect(jsonPath("$.rating").value(4))
                .andExpect(jsonPath("$.remarks").value("Punctual and careful."))
                .andExpect(jsonPath("$.reviewedBy").value("employer@example.com"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        List<PerformanceReview> saved = performanceReviewRepository.findByWorkerIdOrderByCreatedAtDesc(5L);
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getRating()).isEqualTo(4);
        assertThat(saved.get(0).getReviewedBy()).isEqualTo("employer@example.com");
    }

    @Test
    @DisplayName("should accept the legacy X-User-Roles header as a role fallback")
    void submitReview_acceptsLegacyXUserRolesHeader() throws Exception {
        mockMvc.perform(post("/performance/review")
                        .header("X-User-Roles", "ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.workerId").value(5));
    }

    @Test
    @DisplayName("should treat the role header case-insensitively")
    void submitReview_acceptsLowercaseRole() throws Exception {
        mockMvc.perform(post("/performance/review")
                        .header("X-User-Role", "employer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("should reject a review with no role header (403)")
    void submitReview_rejectsMissingRole() throws Exception {
        mockMvc.perform(postReview(null, validRequest()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        containsString("Access denied")));

        assertThat(performanceReviewRepository.count()).isZero();
    }

    @Test
    @DisplayName("should reject a review from a disallowed role (403)")
    void submitReview_rejectsDisallowedRole() throws Exception {
        mockMvc.perform(postReview("WORKER", validRequest()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        containsString("requires one of roles [ADMIN, EMPLOYER]")));
    }

    @ParameterizedTest
    @CsvSource({"0", "6"})
    @DisplayName("should reject a rating outside 1-5 (400)")
    void submitReview_rejectsRatingOutOfRange(int rating) throws Exception {
        PerformanceReviewRequest request = validRequest();
        request.setRating(rating);

        mockMvc.perform(postReview("ADMIN", request))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        containsString("Rating must be between 1 and 5")));
    }

    @Test
    @DisplayName("should reject a request missing required fields (400)")
    void submitReview_rejectsMissingRequiredFields() throws Exception {
        PerformanceReviewRequest request = new PerformanceReviewRequest(); // all null

        mockMvc.perform(postReview("ADMIN", request))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        containsString("Worker ID is required")))
                .andExpect(jsonPath("$.message").value(
                        containsString("Job ID is required")))
                .andExpect(jsonPath("$.message").value(
                        containsString("Rating is required")))
                .andExpect(jsonPath("$.message").value(
                        containsString("Reviewed by is required")));
    }

    @Test
    @DisplayName("should reject a malformed JSON body (400)")
    void submitReview_rejectsMalformedBody() throws Exception {
        mockMvc.perform(post("/performance/review")
                        .header("X-User-Role", "ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"workerId\": \"not-a-number\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        containsString("Malformed request body")));
    }

    @Test
    @DisplayName("should reject valid JSON with a wrongly-typed field (400)")
    void submitReview_rejectsWrongFieldType() throws Exception {
        mockMvc.perform(post("/performance/review")
                        .header("X-User-Role", "ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"workerId\": \"abc\", \"jobId\": 3, "
                                + "\"rating\": 4, \"reviewedBy\": \"admin\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        containsString("Malformed request body")));
    }

    // ------------------------------------------------------------------
    // PUT /performance/review/{id}
    // ------------------------------------------------------------------

    private PerformanceReviewUpdateRequest updateRequest(Integer rating, String remarks) {
        PerformanceReviewUpdateRequest update = new PerformanceReviewUpdateRequest();
        update.setRating(rating);
        update.setRemarks(remarks);
        return update;
    }

    @Test
    @DisplayName("should update a review and persist the changes")
    void updateReview_updatesAndPersists() throws Exception {
        PerformanceReview saved = performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(3)
                .remarks("Original").reviewedBy("employer@example.com").build());

        mockMvc.perform(put("/performance/review/" + saved.getId())
                        .header("X-User-Role", "ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                updateRequest(5, "Revised after follow-up"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(saved.getId().intValue()))
                .andExpect(jsonPath("$.workerId").value(5))
                .andExpect(jsonPath("$.rating").value(5))
                .andExpect(jsonPath("$.remarks").value("Revised after follow-up"))
                .andExpect(jsonPath("$.reviewedBy").value("employer@example.com"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        PerformanceReview updated = performanceReviewRepository
                .findById(saved.getId()).orElseThrow();
        assertThat(updated.getRating()).isEqualTo(5);
        assertThat(updated.getRemarks()).isEqualTo("Revised after follow-up");
        assertThat(updated.getWorkerId()).isEqualTo(5L);
        assertThat(updated.getReviewedBy()).isEqualTo("employer@example.com");
    }

    @Test
    @DisplayName("should return 404 when the review does not exist")
    void updateReview_returns404ForMissingReview() throws Exception {
        mockMvc.perform(put("/performance/review/999")
                        .header("X-User-Role", "ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest(4, null))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        containsString("PerformanceReview not found with id")));
    }

    @Test
    @DisplayName("should reject a worker editing a review (403)")
    void updateReview_rejectsWorker() throws Exception {
        mockMvc.perform(put("/performance/review/1")
                        .header("X-User-Role", "WORKER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest(4, null))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        containsString("requires one of roles [ADMIN, EMPLOYER]")));
    }

    @Test
    @DisplayName("should reject an update with no role header (403)")
    void updateReview_rejectsMissingRole() throws Exception {
        mockMvc.perform(put("/performance/review/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest(4, null))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("should reject an invalid rating on update (400)")
    void updateReview_rejectsInvalidRating() throws Exception {
        mockMvc.perform(put("/performance/review/1")
                        .header("X-User-Role", "ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest(0, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        containsString("Rating must be between 1 and 5")));
    }

    @Test
    @DisplayName("should reject a missing rating on update (400)")
    void updateReview_rejectsMissingRating() throws Exception {
        mockMvc.perform(put("/performance/review/1")
                        .header("X-User-Role", "EMPLOYER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest(null, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        containsString("Rating is required")));
    }

    // ------------------------------------------------------------------
    // DELETE /performance/review/{id}
    // ------------------------------------------------------------------

    @Test
    @DisplayName("should delete a review and confirm it is gone")
    void deleteReview_deletesAndPersists() throws Exception {
        PerformanceReview saved = performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(4)
                .remarks("To be removed").reviewedBy("employer@example.com").build());

        mockMvc.perform(delete("/performance/review/" + saved.getId())
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value(
                        containsString("deleted successfully")));

        assertThat(performanceReviewRepository.existsById(saved.getId())).isFalse();
    }

    @Test
    @DisplayName("should return 404 when the review does not exist")
    void deleteReview_returns404ForMissingReview() throws Exception {
        mockMvc.perform(delete("/performance/review/999")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        containsString("PerformanceReview not found with id")));
    }

    @Test
    @DisplayName("should reject an employer deleting a review (403 — admins only)")
    void deleteReview_rejectsEmployer() throws Exception {
        mockMvc.perform(delete("/performance/review/1")
                        .header("X-User-Role", "EMPLOYER"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        containsString("requires one of roles [ADMIN]")));
    }

    @Test
    @DisplayName("should reject a worker deleting a review (403)")
    void deleteReview_rejectsWorker() throws Exception {
        mockMvc.perform(delete("/performance/review/1")
                        .header("X-User-Role", "WORKER"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("should reject a delete with no role header (403)")
    void deleteReview_rejectsMissingRole() throws Exception {
        mockMvc.perform(delete("/performance/review/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("should reject a non-numeric id (400)")
    void deleteReview_rejectsNonNumericId() throws Exception {
        mockMvc.perform(delete("/performance/review/abc")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------
    // GET /performance/worker/{workerId}
    // ------------------------------------------------------------------

    @Test
    @DisplayName("should return the review history with the average rating")
    void getWorkerPerformance_returnsReviewsAndAverage() throws Exception {
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(5)
                .remarks("Excellent").reviewedBy("admin@example.com").build());
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(4)
                .remarks("Good").reviewedBy("employer@example.com").build());

        mockMvc.perform(get("/performance/worker/5")
                        .header("X-User-Role", "EMPLOYER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workerId").value(5))
                .andExpect(jsonPath("$.reviewCount").value(2))
                .andExpect(jsonPath("$.averageRating").value(4.5))
                .andExpect(jsonPath("$.reviews.length()").value(2));
    }

    @Test
    @DisplayName("should return the full 1-5 rating distribution")
    void getWorkerPerformance_returnsRatingDistribution() throws Exception {
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(5)
                .remarks("Five").reviewedBy("employer@example.com").build());
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(5)
                .remarks("Five again").reviewedBy("admin@example.com").build());
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(3)
                .remarks("Three").reviewedBy("employer@example.com").build());

        mockMvc.perform(get("/performance/worker/5")
                        .header("X-User-Role", "EMPLOYER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ratingDistribution.length()").value(5))
                .andExpect(jsonPath("$.ratingDistribution[0].rating").value(1))
                .andExpect(jsonPath("$.ratingDistribution[0].count").value(0))
                .andExpect(jsonPath("$.ratingDistribution[1].rating").value(2))
                .andExpect(jsonPath("$.ratingDistribution[1].count").value(0))
                .andExpect(jsonPath("$.ratingDistribution[2].rating").value(3))
                .andExpect(jsonPath("$.ratingDistribution[2].count").value(1))
                .andExpect(jsonPath("$.ratingDistribution[3].rating").value(4))
                .andExpect(jsonPath("$.ratingDistribution[3].count").value(0))
                .andExpect(jsonPath("$.ratingDistribution[4].rating").value(5))
                .andExpect(jsonPath("$.ratingDistribution[4].count").value(2));
    }

    @Test
    @DisplayName("should return an all-zero distribution for a worker with no reviews")
    void getWorkerPerformance_returnsAllZeroDistribution() throws Exception {
        mockMvc.perform(get("/performance/worker/99")
                        .header("X-User-Role", "EMPLOYER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ratingDistribution.length()").value(5))
                .andExpect(jsonPath("$.ratingDistribution[0].rating").value(1))
                .andExpect(jsonPath("$.ratingDistribution[0].count").value(0))
                .andExpect(jsonPath("$.ratingDistribution[4].rating").value(5))
                .andExpect(jsonPath("$.ratingDistribution[4].count").value(0));
    }

    @Test
    @DisplayName("should let a worker view their own reviews when X-User-Id matches workerId")
    void getWorkerPerformance_workerCanViewOwnReviews() throws Exception {
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(4)
                .remarks("Good").reviewedBy("employer@example.com").build());

        mockMvc.perform(get("/performance/worker/5")
                        .header("X-User-Role", "WORKER")
                        .header("X-User-Id", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workerId").value(5))
                .andExpect(jsonPath("$.reviewCount").value(1));
    }

    @Test
    @DisplayName("should reject a worker viewing another worker's reviews (403)")
    void getWorkerPerformance_rejectsWorkerViewingAnotherWorker() throws Exception {
        mockMvc.perform(get("/performance/worker/5")
                        .header("X-User-Role", "WORKER")
                        .header("X-User-Id", "6"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        containsString("only view their own")));
    }

    @Test
    @DisplayName("should reject a worker without an X-User-Id header (403)")
    void getWorkerPerformance_rejectsWorkerWithoutUserIdHeader() throws Exception {
        mockMvc.perform(get("/performance/worker/5")
                        .header("X-User-Role", "WORKER"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        containsString("only view their own")));
    }

    @Test
    @DisplayName("should return an empty report with a null average for an unknown worker")
    void getWorkerPerformance_returnsEmptyReport() throws Exception {
        mockMvc.perform(get("/performance/worker/99")
                        .header("X-User-Role", "EMPLOYER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workerId").value(99))
                .andExpect(jsonPath("$.reviewCount").value(0))
                .andExpect(jsonPath("$.averageRating").value(nullValue()))
                .andExpect(jsonPath("$.reviews.length()").value(0));
    }

    @Test
    @DisplayName("should reject with no role header (403)")
    void getWorkerPerformance_rejectsMissingRole() throws Exception {
        mockMvc.perform(get("/performance/worker/5"))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUPERVISOR", "GUEST"})
    @DisplayName("should reject an unknown role (403)")
    void getWorkerPerformance_rejectsUnknownRole(String role) throws Exception {
        mockMvc.perform(get("/performance/worker/5")
                        .header("X-User-Role", role))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        containsString("Access denied")));
    }

    @Test
    @DisplayName("should reject a non-numeric worker id (400)")
    void getWorkerPerformance_rejectsNonNumericWorkerId() throws Exception {
        mockMvc.perform(get("/performance/worker/abc")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------
    // GET /performance/worker/{workerId}/history
    // ------------------------------------------------------------------

    private void saveThreeReviews() {
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(5)
                .remarks("First").reviewedBy("admin@example.com").build());
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(4)
                .remarks("Second").reviewedBy("employer@example.com").build());
        performanceReviewRepository.save(PerformanceReview.builder()
                .workerId(5L).jobId(3L).rating(3)
                .remarks("Third").reviewedBy("employer@example.com").build());
    }

    @Test
    @DisplayName("history endpoint should return a paginated slice with metadata")
    void getWorkerHistory_returnsPaginatedSlice() throws Exception {
        saveThreeReviews();

        mockMvc.perform(get("/performance/worker/5/history")
                        .param("page", "0")
                        .param("size", "2")
                        .header("X-User-Role", "EMPLOYER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workerId").value(5))
                .andExpect(jsonPath("$.reviewCount").value(3))
                .andExpect(jsonPath("$.reviews.length()").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    @DisplayName("history endpoint should return the second page with the remaining reviews")
    void getWorkerHistory_returnsSecondPage() throws Exception {
        saveThreeReviews();

        mockMvc.perform(get("/performance/worker/5/history")
                        .param("page", "1")
                        .param("size", "2")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.reviews.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    @DisplayName("history endpoint distribution should cover the entire history, not just the page")
    void getWorkerHistory_distributionCoversAllReviews() throws Exception {
        saveThreeReviews(); // ratings 5, 4, 3

        mockMvc.perform(get("/performance/worker/5/history")
                        .param("size", "1")
                        .header("X-User-Role", "EMPLOYER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviews.length()").value(1))
                .andExpect(jsonPath("$.reviewCount").value(3))
                .andExpect(jsonPath("$.ratingDistribution.length()").value(5))
                .andExpect(jsonPath("$.ratingDistribution[2].count").value(1)) // rating 3
                .andExpect(jsonPath("$.ratingDistribution[3].count").value(1)) // rating 4
                .andExpect(jsonPath("$.ratingDistribution[4].count").value(1)); // rating 5
    }

    @Test
    @DisplayName("history endpoint should default to page 0 and size 10")
    void getWorkerHistory_usesDefaults() throws Exception {
        mockMvc.perform(get("/performance/worker/5/history")
                        .header("X-User-Role", "WORKER")
                        .header("X-User-Id", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(0))
                .andExpect(jsonPath("$.totalPages").value(0))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    @DisplayName("history endpoint should enforce the worker ownership rule")
    void getWorkerHistory_enforcesWorkerOwnership() throws Exception {
        mockMvc.perform(get("/performance/worker/5/history")
                        .header("X-User-Role", "WORKER")
                        .header("X-User-Id", "6"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(
                        containsString("only view their own")));

        mockMvc.perform(get("/performance/worker/5/history")
                        .header("X-User-Role", "WORKER")
                        .header("X-User-Id", "5"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("history endpoint should reject a missing role (403)")
    void getWorkerHistory_rejectsMissingRole() throws Exception {
        mockMvc.perform(get("/performance/worker/5/history"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("history endpoint should reject invalid pagination (400)")
    void getWorkerHistory_rejectsInvalidPagination() throws Exception {
        mockMvc.perform(get("/performance/worker/5/history")
                        .param("page", "-1")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        containsString("Page must be 0 or greater")));

        mockMvc.perform(get("/performance/worker/5/history")
                        .param("size", "101")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        containsString("Size must be between 1 and 100")));
    }

    @Test
    @DisplayName("unknown paths return 404 (not 500)")
    void unknownPath_returns404() throws Exception {
        mockMvc.perform(get("/performance/definitely-not-a-route"))
                .andExpect(status().isNotFound());
    }
}
