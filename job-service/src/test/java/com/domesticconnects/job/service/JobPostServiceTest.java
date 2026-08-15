package com.domesticconnects.job.service;

import com.domesticconnects.job.dto.JobApplicationResponse;
import com.domesticconnects.job.dto.JobPostResponse;
import com.domesticconnects.job.entity.JobApplication;
import com.domesticconnects.job.entity.JobPost;
import com.domesticconnects.job.entity.JobStatus;
import com.domesticconnects.job.exception.InvalidJobStateException;
import com.domesticconnects.job.exception.ResourceNotFoundException;
import com.domesticconnects.job.repository.JobApplicationRepository;
import com.domesticconnects.job.repository.JobPostRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the profile-review assignment gate: employers/admins must
 * assign through {@code assignWorkerReviewed} (which marks the post
 * {@code profileReviewed}), and only OPEN posts may be assigned either way.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JobPostService")
class JobPostServiceTest {

    @Mock
    private JobPostRepository jobPostRepository;

    @Mock
    private JobApplicationRepository jobApplicationRepository;

    @Mock
    private NotificationPublisher notificationPublisher;

    private JobPostService jobPostService;

    @BeforeEach
    void setUp() {
        jobPostService = new JobPostService(
                jobPostRepository, jobApplicationRepository, notificationPublisher);
    }

    private JobPost openPost(Long id) {
        return JobPost.builder()
                .id(id)
                .title("Cleaning")
                .description("Need a reliable helper.")
                .employerId(1L)
                .wagePerDay(new BigDecimal("500.00"))
                .location("Bengaluru")
                .status(JobStatus.OPEN)
                .build();
    }

    @Test
    @DisplayName("assignWorkerReviewed assigns, marks profileReviewed and publishes the notification")
    void assignWorkerReviewed_assignsAndMarksProfileReviewed() {
        JobPost post = openPost(7L);
        when(jobPostRepository.findActiveById(7L)).thenReturn(Optional.of(post));

        JobPostResponse response = jobPostService.assignWorkerReviewed(7L, 42L);

        assertThat(response.getWorkerId()).isEqualTo(42L);
        assertThat(response.getStatus()).isEqualTo(JobStatus.ASSIGNED);
        assertThat(response.isProfileReviewed()).isTrue();
        verify(notificationPublisher).publishJobAssigned(42L, 7L, "Cleaning");
    }

    @Test
    @DisplayName("plain assignWorker leaves profileReviewed false (worker self-application)")
    void assignWorker_doesNotMarkProfileReviewed() {
        JobPost post = openPost(7L);
        when(jobPostRepository.findActiveById(7L)).thenReturn(Optional.of(post));

        JobPostResponse response = jobPostService.assignWorker(7L, 42L);

        assertThat(response.getWorkerId()).isEqualTo(42L);
        assertThat(response.getStatus()).isEqualTo(JobStatus.ASSIGNED);
        assertThat(response.isProfileReviewed()).isFalse();
    }

    @Test
    @DisplayName("assignWorkerReviewed rejects a post that is not OPEN")
    void assignWorkerReviewed_rejectsNonOpenPost() {
        JobPost post = openPost(7L);
        post.setStatus(JobStatus.ASSIGNED);
        when(jobPostRepository.findActiveById(7L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> jobPostService.assignWorkerReviewed(7L, 42L))
                .isInstanceOf(InvalidJobStateException.class);
        verify(jobPostRepository, never()).save(any(JobPost.class));
        verify(notificationPublisher, never()).publishJobAssigned(any(), any(), any());
    }

    @Test
    @DisplayName("applyToJob records a PENDING application and keeps the job OPEN")
    void applyToJob_recordsPendingApplication() {
        JobPost post = openPost(7L);
        when(jobPostRepository.findActiveById(7L)).thenReturn(Optional.of(post));
        when(jobApplicationRepository.findByJobIdAndWorkerId(7L, 42L))
                .thenReturn(Optional.empty());
        when(jobApplicationRepository.save(any(JobApplication.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        JobApplicationResponse response = jobPostService.applyToJob(7L, 42L);

        assertThat(response.getStatus()).isEqualTo(JobApplication.ApplicationStatus.PENDING);
        assertThat(response.getWorkerId()).isEqualTo(42L);
        assertThat(response.getJobId()).isEqualTo(7L);
        // Application does NOT assign: the post stays OPEN with no worker.
        assertThat(post.getStatus()).isEqualTo(JobStatus.OPEN);
        assertThat(post.getWorkerId()).isNull();
        verify(notificationPublisher, never()).publishJobAssigned(any(), any(), any());
    }

    @Test
    @DisplayName("acceptApplication assigns with profileReviewed and marks the application ACCEPTED")
    void acceptApplication_assignsAndMarksAccepted() {
        JobPost post = openPost(7L);
        JobApplication application = JobApplication.builder()
                .id(9L)
                .jobId(7L)
                .workerId(42L)
                .status(JobApplication.ApplicationStatus.PENDING)
                .build();
        when(jobPostRepository.findActiveById(7L)).thenReturn(Optional.of(post));
        when(jobApplicationRepository.findById(9L)).thenReturn(Optional.of(application));

        JobPostResponse response = jobPostService.acceptApplication(7L, 9L);

        assertThat(response.getStatus()).isEqualTo(JobStatus.ASSIGNED);
        assertThat(response.getWorkerId()).isEqualTo(42L);
        assertThat(response.isProfileReviewed()).isTrue();
        assertThat(application.getStatus()).isEqualTo(JobApplication.ApplicationStatus.ACCEPTED);
        verify(notificationPublisher).publishJobAssigned(42L, 7L, "Cleaning");
    }

    @Test
    @DisplayName("acceptApplication rejects when the application belongs to another job")
    void acceptApplication_rejectsMismatchedJob() {
        JobPost post = openPost(7L);
        JobApplication application = JobApplication.builder()
                .id(9L)
                .jobId(99L) // different job
                .workerId(42L)
                .build();
        when(jobPostRepository.findActiveById(7L)).thenReturn(Optional.of(post));
        when(jobApplicationRepository.findById(9L)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> jobPostService.acceptApplication(7L, 9L))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(notificationPublisher, never()).publishJobAssigned(any(), any(), any());
    }

    @Test
    @DisplayName("getAssignedWorkerIds returns the employer's assigned workers from the repository")
    void getAssignedWorkerIds_returnsAssignedWorkers() {
        when(jobPostRepository.findAssignedWorkerIdsByEmployerId(1L))
                .thenReturn(List.of(10L, 11L));

        List<Long> result = jobPostService.getAssignedWorkerIds(1L);

        assertThat(result).containsExactly(10L, 11L);
        verify(jobPostRepository).findAssignedWorkerIdsByEmployerId(1L);
    }

    @Test
    @DisplayName("declineApplication marks the application DECLINED and leaves the job OPEN")
    void declineApplication_marksDeclined() {
        JobPost post = openPost(7L);
        JobApplication application = JobApplication.builder()
                .id(9L)
                .jobId(7L)
                .workerId(42L)
                .status(JobApplication.ApplicationStatus.PENDING)
                .build();
        when(jobPostRepository.findActiveById(7L)).thenReturn(Optional.of(post));
        when(jobApplicationRepository.findById(9L)).thenReturn(Optional.of(application));

        JobApplicationResponse response = jobPostService.declineApplication(7L, 9L);

        assertThat(response.getStatus()).isEqualTo(JobApplication.ApplicationStatus.DECLINED);
        assertThat(post.getStatus()).isEqualTo(JobStatus.OPEN);
    }
}
