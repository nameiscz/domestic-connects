package com.domesticconnects.job.repository;

import com.domesticconnects.job.entity.JobPost;
import com.domesticconnects.job.entity.JobStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@DisplayName("JobPostRepository")
class JobPostRepositoryTest {

    @Autowired
    private JobPostRepository jobPostRepository;

    private JobPost createJobPost(String title) {
        return JobPost.builder()
                .title(title)
                .description("Need a reliable helper for daily household tasks.")
                .employerId(1L)
                .wagePerDay(new BigDecimal("500.00"))
                .location("Colombo")
                .status(JobStatus.OPEN)
                .build();
    }

    private JobPost saveDeletedJobPost(String title) {
        JobPost post = jobPostRepository.save(createJobPost(title));
        post.setDeleted(true);
        return jobPostRepository.save(post);
    }

    @Test
    @DisplayName("findAllActive should exclude soft-deleted posts")
    void findAllActive_excludesSoftDeletedPosts() {
        JobPost active = jobPostRepository.save(createJobPost("Active job"));
        JobPost deleted = saveDeletedJobPost("Deleted job");

        List<JobPost> result = jobPostRepository.findAllActive();

        assertThat(result)
                .extracting(JobPost::getId)
                .contains(active.getId())
                .doesNotContain(deleted.getId());
    }

    @Test
    @DisplayName("findActiveById should return empty for a soft-deleted post")
    void findActiveById_returnsEmptyForSoftDeletedPost() {
        JobPost deleted = saveDeletedJobPost("Deleted job");

        Optional<JobPost> result = jobPostRepository.findActiveById(deleted.getId());

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("findActiveById should return an active post with defaults populated")
    void findActiveById_returnsActivePost() {
        JobPost active = jobPostRepository.save(createJobPost("Active job"));

        Optional<JobPost> result = jobPostRepository.findActiveById(active.getId());

        assertThat(result).isPresent();
        assertThat(result.get().getStatus()).isEqualTo(JobStatus.OPEN);
        assertThat(result.get().isDeleted()).isFalse();
        assertThat(result.get().getCreatedAt()).isNotNull();
    }
}
