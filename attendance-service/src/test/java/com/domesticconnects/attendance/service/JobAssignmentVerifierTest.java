package com.domesticconnects.attendance.service;

import com.domesticconnects.attendance.client.JobServiceClient;
import com.domesticconnects.attendance.dto.AttendanceRequest;
import com.domesticconnects.attendance.dto.JobPostSummary;
import com.domesticconnects.attendance.entity.AttendanceStatus;
import com.domesticconnects.attendance.exception.AccessDeniedException;
import feign.FeignException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link JobAssignmentVerifier} — the gate that restricts
 * employers to marking/viewing attendance only for workers assigned to their
 * own jobs.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JobAssignmentVerifier")
class JobAssignmentVerifierTest {

    @Mock
    private JobServiceClient jobServiceClient;

    private JobAssignmentVerifier verifier;

    @BeforeEach
    void setUp() {
        verifier = new JobAssignmentVerifier(jobServiceClient);
    }

    private AttendanceRequest markRequest(Long workerId, Long jobId) {
        AttendanceRequest request = new AttendanceRequest();
        request.setWorkerId(workerId);
        request.setJobId(jobId);
        request.setDate(LocalDate.of(2026, 8, 3));
        request.setStatus(AttendanceStatus.PRESENT);
        return request;
    }

    private JobPostSummary job(Long id, Long employerId, Long workerId, String status) {
        return JobPostSummary.builder()
                .id(id)
                .employerId(employerId)
                .workerId(workerId)
                .status(status)
                .build();
    }

    @Test
    @DisplayName("should allow marking attendance on the employer's own ASSIGNED job")
    void verifyEmployerCanMark_allowsOwnAssignedJob() {
        when(jobServiceClient.getJobPost(1L)).thenReturn(job(1L, 5L, 10L, "ASSIGNED"));

        assertThatCode(() -> verifier.verifyEmployerCanMark(5L, markRequest(10L, 1L)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("should reject marking attendance on another employer's job")
    void verifyEmployerCanMark_rejectsOtherEmployersJob() {
        when(jobServiceClient.getJobPost(1L)).thenReturn(job(1L, 99L, 10L, "ASSIGNED"));

        assertThatThrownBy(() -> verifier.verifyEmployerCanMark(5L, markRequest(10L, 1L)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("should reject marking attendance for a worker not assigned to the job")
    void verifyEmployerCanMark_rejectsWorkerNotAssignedToJob() {
        when(jobServiceClient.getJobPost(1L)).thenReturn(job(1L, 5L, 11L, "ASSIGNED"));

        assertThatThrownBy(() -> verifier.verifyEmployerCanMark(5L, markRequest(10L, 1L)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("should reject marking attendance against a job that is not ASSIGNED")
    void verifyEmployerCanMark_rejectsNonAssignedJob() {
        when(jobServiceClient.getJobPost(1L)).thenReturn(job(1L, 5L, 10L, "OPEN"));

        assertThatThrownBy(() -> verifier.verifyEmployerCanMark(5L, markRequest(10L, 1L)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("should reject marking attendance when the job does not exist")
    void verifyEmployerCanMark_rejectsMissingJob() {
        FeignException.NotFound notFound = mock(FeignException.NotFound.class);
        when(jobServiceClient.getJobPost(1L)).thenThrow(notFound);

        assertThatThrownBy(() -> verifier.verifyEmployerCanMark(5L, markRequest(10L, 1L)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("should allow viewing attendance for an assigned worker")
    void verifyEmployerCanView_allowsAssignedWorker() {
        when(jobServiceClient.getAssignedWorkerIds(5L)).thenReturn(List.of(10L, 11L));

        assertThatCode(() -> verifier.verifyEmployerCanView(5L, 10L))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("should reject viewing attendance for a worker the employer has not hired")
    void verifyEmployerCanView_rejectsUnassignedWorker() {
        when(jobServiceClient.getAssignedWorkerIds(5L)).thenReturn(List.of(10L));

        assertThatThrownBy(() -> verifier.verifyEmployerCanView(5L, 11L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("assignedWorkerIds should return the employer's hired workers as a set")
    void assignedWorkerIds_returnsSet() {
        when(jobServiceClient.getAssignedWorkerIds(5L)).thenReturn(List.of(10L, 11L, 10L));

        assertThat(verifier.assignedWorkerIds(5L)).isEqualTo(Set.of(10L, 11L));
    }
}
