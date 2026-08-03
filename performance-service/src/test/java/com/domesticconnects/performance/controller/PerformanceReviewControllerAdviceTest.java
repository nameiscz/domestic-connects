package com.domesticconnects.performance.controller;

import com.domesticconnects.performance.service.PerformanceReviewService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller-slice test for the {@code GlobalExceptionHandler} advice: maps the
 * optimistic-lock conflict thrown by a concurrent {@code PUT} to HTTP 409.
 * (The full-context tests cannot deterministically trigger real concurrency,
 * so the service is mocked here to throw the conflict.)
 */
@WebMvcTest(PerformanceReviewController.class)
@DisplayName("GlobalExceptionHandler advice (controller slice)")
class PerformanceReviewControllerAdviceTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PerformanceReviewService performanceReviewService;

    @Test
    @DisplayName("optimistic-lock conflicts should map to 409 Conflict")
    void optimisticLockConflict_returns409() throws Exception {
        when(performanceReviewService.updateReview(any(), any()))
                .thenThrow(new ObjectOptimisticLockingFailureException(
                        "PerformanceReview", 1L, null));

        mockMvc.perform(put("/performance/review/1")
                        .header("X-User-Role", "ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":4}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        containsString("modified concurrently")));
    }
}
