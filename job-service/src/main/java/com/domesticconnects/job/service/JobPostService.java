package com.domesticconnects.job.service;

import com.domesticconnects.job.audit.Auditable;
import com.domesticconnects.job.config.RedisCacheConfig;
import com.domesticconnects.job.dto.JobPostRequest;
import com.domesticconnects.job.dto.JobPostResponse;
import com.domesticconnects.job.entity.JobPost;
import com.domesticconnects.job.entity.JobStatus;
import com.domesticconnects.job.exception.InvalidJobStateException;
import com.domesticconnects.job.exception.JobStatusException;
import com.domesticconnects.job.exception.ResourceNotFoundException;
import com.domesticconnects.job.repository.JobPostRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class JobPostService {

    private static final Logger log = LoggerFactory.getLogger(JobPostService.class);

    private final JobPostRepository jobPostRepository;
    private final NotificationPublisher notificationPublisher;

    @Transactional
    @Auditable(action = "CREATE", entity = "JobPost", newValueParam = 0)
    @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POSTS, allEntries = true)
    public JobPostResponse createJobPost(JobPostRequest request) {
        JobPost jobPost = JobPost.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .employerId(request.getEmployerId())
                .wagePerDay(request.getWagePerDay())
                .location(request.getLocation())
                .status(JobStatus.OPEN)
                .build();

        jobPost = jobPostRepository.save(jobPost);

        log.info("Job post created with id: {}", jobPost.getId());
        return toResponse(jobPost);
    }

    @Cacheable(cacheNames = RedisCacheConfig.CACHE_JOB_POSTS)
    @Transactional(readOnly = true)
    public List<JobPostResponse> getAllJobPosts() {
        return jobPostRepository.findAllActive().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Cacheable(cacheNames = RedisCacheConfig.CACHE_JOB_POST, key = "#id")
    @Transactional(readOnly = true)
    public JobPostResponse getJobPost(Long id) {
        return toResponse(findActiveJobPost(id));
    }

    @Transactional
    @Auditable(action = "UPDATE", entity = "JobPost", idParam = 0, newValueParam = 1)
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POSTS, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POST, key = "#id")
    })
    public JobPostResponse updateJobPost(Long id, JobPostRequest request) {
        JobPost jobPost = findActiveJobPost(id);

        if (jobPost.getStatus() == JobStatus.CLOSED) {
            throw new JobStatusException("Cannot update a closed job post");
        }

        jobPost.setTitle(request.getTitle());
        jobPost.setDescription(request.getDescription());
        jobPost.setEmployerId(request.getEmployerId());
        jobPost.setWagePerDay(request.getWagePerDay());
        jobPost.setLocation(request.getLocation());

        log.info("Job post updated with id: {}", jobPost.getId());
        return toResponse(jobPost);
    }

    /**
     * Soft deletes a job post by flipping {@code isDeleted} to {@code true}.
     * The row remains in the database but is hidden from every query.
     */
    @Transactional
    @Auditable(action = "DELETE", entity = "JobPost", idParam = 0,
            oldValueParam = 0, detail = "Soft-delete job post")
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POSTS, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POST, key = "#id")
    })
    public void softDeleteJobPost(Long id) {
        JobPost jobPost = findActiveJobPost(id);
        jobPost.setDeleted(true);

        log.info("Job post soft-deleted with id: {}", id);
    }

    /**
     * Assigns a worker to a job post, moving its status to {@code ASSIGNED}.
     * Only {@code OPEN} posts can be assigned; assigning an already-assigned
     * or closed post is rejected with {@link InvalidJobStateException}. The
     * {@code @Version} field on {@link JobPost} additionally guarantees that
     * two concurrent assignment attempts cannot both succeed: the loser fails
     * at the persistence layer with an optimistic-lock conflict.
     */
    @Transactional
    @Auditable(action = "ASSIGN", entity = "JobPost", idParam = 0,
            newValueParam = 1, detail = "Assign worker to job post")
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POSTS, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POST, key = "#id")
    })
    public JobPostResponse assignWorker(Long id, Long workerId) {
        JobPost jobPost = findActiveJobPost(id);

        if (jobPost.getStatus() != JobStatus.OPEN) {
            throw new InvalidJobStateException(id, jobPost.getStatus());
        }

        jobPost.setStatus(JobStatus.ASSIGNED);
        jobPost.setWorkerId(workerId);

        log.info("Worker {} assigned to job post {}", workerId, id);
        // Best-effort notification — never fails the assignment.
        notificationPublisher.publishJobAssigned(workerId, id, jobPost.getTitle());
        return toResponse(jobPost);
    }

    /**
     * Fetches a job post that is neither deleted nor missing.
     */
    private JobPost findActiveJobPost(Long id) {
        return jobPostRepository.findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("JobPost", "id", id));
    }

    private JobPostResponse toResponse(JobPost jobPost) {
        return JobPostResponse.builder()
                .id(jobPost.getId())
                .title(jobPost.getTitle())
                .description(jobPost.getDescription())
                .employerId(jobPost.getEmployerId())
                .workerId(jobPost.getWorkerId())
                .wagePerDay(jobPost.getWagePerDay())
                .location(jobPost.getLocation())
                .status(jobPost.getStatus())
                .createdAt(jobPost.getCreatedAt())
                .build();
    }
}
