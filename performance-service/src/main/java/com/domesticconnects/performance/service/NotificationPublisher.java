package com.domesticconnects.performance.service;

import com.domesticconnects.performance.dto.NotificationEvent;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Publishes the {@code performance-reviewed} notification event whenever a
 * performance review is submitted for a worker. Publishing is <b>best-effort</b>:
 * a Kafka outage or serialization failure is logged and swallowed so the review
 * submission itself never fails — the notification consumer simply won't see
 * the event.
 */
@Component
@RequiredArgsConstructor
public class NotificationPublisher {

    private static final Logger log = LoggerFactory.getLogger(NotificationPublisher.class);

    private static final String TOPIC_PERFORMANCE_REVIEWED = "performance-reviewed";
    private static final String TYPE_PERFORMANCE_REVIEWED = "PERFORMANCE_REVIEWED";

    private final KafkaTemplate<String, NotificationEvent> kafkaTemplate;

    /**
     * Emits a {@code performance-reviewed} event for the given worker/review.
     *
     * @param workerId the worker the review was submitted for
     * @param reviewId the persisted review id
     */
    public void publishReviewSubmitted(Long workerId, Long reviewId) {
        NotificationEvent event = NotificationEvent.builder()
                .userId(workerId)
                .type(TYPE_PERFORMANCE_REVIEWED)
                .message("A new performance review has been submitted for you.")
                .referenceId(reviewId)
                .timestamp(LocalDateTime.now())
                .build();

        try {
            kafkaTemplate.send(TOPIC_PERFORMANCE_REVIEWED, String.valueOf(workerId), event)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.warn("Failed to publish performance-reviewed event for worker {} review {}: {}",
                                    workerId, reviewId, ex.getMessage());
                        }
                    });
        } catch (Exception e) {
            log.warn("Failed to publish performance-reviewed event for worker {} review {}: {}",
                    workerId, reviewId, e.getMessage());
        }
    }
}
