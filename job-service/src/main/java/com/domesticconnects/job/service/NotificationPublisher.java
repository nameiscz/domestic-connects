package com.domesticconnects.job.service;

import com.domesticconnects.job.dto.NotificationEvent;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Publishes the {@code job-assigned} notification event whenever a worker is
 * assigned to a job post. Publishing is <b>best-effort</b>: a Kafka outage or
 * serialization failure is logged and swallowed so the assignment itself never
 * fails — the notification consumer simply won't see the event.
 */
@Component
@RequiredArgsConstructor
public class NotificationPublisher {

    private static final Logger log = LoggerFactory.getLogger(NotificationPublisher.class);

    private static final String TOPIC_JOB_ASSIGNED = "job-assigned";
    private static final String TYPE_JOB_ASSIGNED = "JOB_ASSIGNED";

    private final KafkaTemplate<String, NotificationEvent> kafkaTemplate;

    /**
     * Emits a {@code job-assigned} event for the given worker/job pair.
     *
     * @param workerId the worker who was assigned
     * @param jobId    the job post they were assigned to
     * @param jobTitle the job title, used in the notification message
     */
    public void publishJobAssigned(Long workerId, Long jobId, String jobTitle) {
        NotificationEvent event = NotificationEvent.builder()
                .userId(workerId)
                .type(TYPE_JOB_ASSIGNED)
                .message("You have been assigned to the job \"" + jobTitle + "\".")
                .referenceId(jobId)
                .timestamp(LocalDateTime.now())
                .build();

        try {
            kafkaTemplate.send(TOPIC_JOB_ASSIGNED, String.valueOf(workerId), event)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.warn("Failed to publish job-assigned event for worker {} job {}: {}",
                                    workerId, jobId, ex.getMessage());
                        }
                    });
        } catch (Exception e) {
            log.warn("Failed to publish job-assigned event for worker {} job {}: {}",
                    workerId, jobId, e.getMessage());
        }
    }
}
