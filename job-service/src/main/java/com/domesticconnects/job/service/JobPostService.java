package com.domesticconnects.job.service;

import com.domesticconnects.job.audit.Auditable;
import com.domesticconnects.job.config.RedisCacheConfig;
import com.domesticconnects.job.dto.JobApplicationResponse;
import com.domesticconnects.job.dto.JobPostRequest;
import com.domesticconnects.job.dto.JobPostResponse;
import com.domesticconnects.job.entity.JobApplication;
import com.domesticconnects.job.entity.JobPost;
import com.domesticconnects.job.entity.JobStatus;
import com.domesticconnects.job.exception.InvalidJobStateException;
import com.domesticconnects.job.exception.JobStatusException;
import com.domesticconnects.job.exception.ResourceNotFoundException;
import com.domesticconnects.job.repository.JobApplicationRepository;
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
    private final JobApplicationRepository jobApplicationRepository;
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

    /**
     * Distinct worker ids currently assigned to the employer's active job
     * posts (status {@code ASSIGNED}). Consumed by attendance-service to
     * scope employer attendance access to only the workers they have hired.
     */
    @Transactional(readOnly = true)
    public List<Long> getAssignedWorkerIds(Long employerId) {
        return jobPostRepository.findAssignedWorkerIdsByEmployerId(employerId);
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
     * Assigns a worker to a job post <b>after the employer reviewed the
     * worker's profile</b>, moving its status to {@code ASSIGNED} and marking
     * the post {@code profileReviewed}. This is the only assignment path for
     * employers/admins — the plain {@link #assignWorker(Long, Long)} stays
     * reserved for workers applying to their own postings (see
     * {@code JobPostController}).
     *
     * Same state rules as {@link #assignWorker}: only {@code OPEN} posts can
     * be assigned, and the optimistic-lock version prevents two concurrent
     * assignments from both succeeding.
     */
    @Transactional
    @Auditable(action = "ASSIGN", entity = "JobPost", idParam = 0,
            newValueParam = 1, detail = "Assign worker after profile review")
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POSTS, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POST, key = "#id")
    })
    public JobPostResponse assignWorkerReviewed(Long id, Long workerId) {
        JobPost jobPost = findActiveJobPost(id);

        if (jobPost.getStatus() != JobStatus.OPEN) {
            throw new InvalidJobStateException(id, jobPost.getStatus());
        }

        jobPost.setProfileReviewed(true);
        jobPost.setStatus(JobStatus.ASSIGNED);
        jobPost.setWorkerId(workerId);

        log.info("Worker {} assigned to job post {} after profile review", workerId, id);
        // Best-effort notification — never fails the assignment.
        notificationPublisher.publishJobAssigned(workerId, id, jobPost.getTitle());
        return toResponse(jobPost);
    }

    /**
     * Records a worker's application to an OPEN job post. The job stays OPEN —
     * the employer decides, after reviewing the worker's profile, whether to
     * accept (which assigns) or decline. Re-applying updates the existing row
     * back to PENDING rather than creating a duplicate.
     *
     * @return the application row (PENDING), or {@code null} when the job is
     *         already ASSIGNED/CLOSED and the worker has no pending row (the
     *         caller then falls back to the plain assignment path).
     */
    @Transactional
    @Auditable(action = "APPLY", entity = "JobPost", idParam = 0,
            newValueParam = 1, detail = "Worker applies to job post")
    @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POSTS, allEntries = true)
    public JobApplicationResponse applyToJob(Long jobId, Long workerId) {
        JobPost jobPost = findActiveJobPost(jobId);

        JobApplication existing = jobApplicationRepository
                .findByJobIdAndWorkerId(jobId, workerId)
                .orElse(null);

        // Already assigned/closed and not re-applying from a pending row: let
        // the controller fall through to the assignment path (which will
        // produce the proper state error).
        if (jobPost.getStatus() != JobStatus.OPEN && existing == null) {
            return null;
        }

        JobApplication application = existing != null ? existing : JobApplication.builder()
                .jobId(jobId)
                .workerId(workerId)
                .status(JobApplication.ApplicationStatus.PENDING)
                .build();
        application.setStatus(JobApplication.ApplicationStatus.PENDING);
        jobApplicationRepository.save(application);

        log.info("Worker {} applied to job post {}", workerId, jobId);
        return toApplicationResponse(application, jobPost.getTitle());
    }

    /**
     * Lists the applications for a job post (newest first) — the employer's
     * applicant list. Pending applications are returned for every status;
     * accept/decline is driven off these rows.
     */
    @Transactional(readOnly = true)
    public List<JobApplicationResponse> getJobApplications(Long jobId) {
        JobPost jobPost = findActiveJobPost(jobId);
        return jobApplicationRepository.findByJobIdOrderByCreatedAtDesc(jobId)
                .stream()
                .map(a -> toApplicationResponse(a, jobPost.getTitle()))
                .toList();
    }

    /**
     * Accepts a worker's application: verifies the post is still OPEN, assigns
     * the worker with the profile-reviewed flag set (the employer reviewed the
     * profile before accepting) and marks the application ACCEPTED. Declined
     * applications can be re-accepted while the job stays open; the assigned
     * row flips to ACCEPTED and the post becomes ASSIGNED.
     */
    @Transactional
    @Auditable(action = "ASSIGN", entity = "JobPost", idParam = 0,
            newValueParam = 1, detail = "Accept worker application after profile review")
    @Caching(evict = {
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POSTS, allEntries = true),
            @CacheEvict(cacheNames = RedisCacheConfig.CACHE_JOB_POST, key = "#jobId")
    })
    public JobPostResponse acceptApplication(Long jobId, Long applicationId) {
        JobPost jobPost = findActiveJobPost(jobId);
        if (jobPost.getStatus() != JobStatus.OPEN) {
            throw new InvalidJobStateException(jobId, jobPost.getStatus());
        }

        JobApplication application = jobApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "JobApplication", "id", applicationId));
        if (!application.getJobId().equals(jobId)) {
            throw new ResourceNotFoundException(
                    "JobApplication", "id", applicationId);
        }

        Long workerId = application.getWorkerId();
        jobPost.setProfileReviewed(true);
        jobPost.setStatus(JobStatus.ASSIGNED);
        jobPost.setWorkerId(workerId);

        application.setStatus(JobApplication.ApplicationStatus.ACCEPTED);
        jobApplicationRepository.save(application);

        log.info("Application {} accepted: worker {} assigned to job post {}",
                applicationId, workerId, jobId);
        // Best-effort notification — never fails the assignment.
        notificationPublisher.publishJobAssigned(workerId, jobId, jobPost.getTitle());
        return toResponse(jobPost);
    }

    /**
     * Declines a worker's application. The post stays OPEN so other applicants
     * (or the worker themselves) can still be considered later.
     */
    @Transactional
    @Auditable(action = "DECLINE", entity = "JobPost", idParam = 0,
            detail = "Decline worker application")
    public JobApplicationResponse declineApplication(Long jobId, Long applicationId) {
        findActiveJobPost(jobId);
        JobApplication application = jobApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "JobApplication", "id", applicationId));
        if (!application.getJobId().equals(jobId)) {
            throw new ResourceNotFoundException(
                    "JobApplication", "id", applicationId);
        }

        application.setStatus(JobApplication.ApplicationStatus.DECLINED);
        jobApplicationRepository.save(application);

        log.info("Application {} declined for job post {}", applicationId, jobId);
        return toApplicationResponse(application, null);
    }

    /**
     * Fetches a job post that is neither deleted nor missing.
     */
    private JobPost findActiveJobPost(Long id) {
        return jobPostRepository.findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("JobPost", "id", id));
    }

    private JobApplicationResponse toApplicationResponse(JobApplication application, String jobTitle) {
        return JobApplicationResponse.builder()
                .id(application.getId())
                .jobId(application.getJobId())
                .jobTitle(jobTitle)
                .workerId(application.getWorkerId())
                .status(application.getStatus())
                .createdAt(application.getCreatedAt())
                .build();
    }

    private JobPostResponse toResponse(JobPost jobPost) {
        return JobPostResponse.builder()
                .id(jobPost.getId())
                .title(jobPost.getTitle())
                .description(jobPost.getDescription())
                .employerId(jobPost.getEmployerId())
                .workerId(jobPost.getWorkerId())
                .profileReviewed(jobPost.isProfileReviewed())
                .wagePerDay(jobPost.getWagePerDay())
                .location(jobPost.getLocation())
                .status(jobPost.getStatus())
                .createdAt(jobPost.getCreatedAt())
                .build();
    }
}
