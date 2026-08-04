package com.domesticconnects.notification.service;

import com.domesticconnects.notification.dto.NotificationEvent;
import com.domesticconnects.notification.entity.NotificationLog;
import com.domesticconnects.notification.entity.NotificationType;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumes the three notification topics and persists each event as a
 * {@link NotificationLog} via {@link NotificationService}.
 * <p>
 * One listener per topic keeps the topic→type mapping explicit even though the
 * event payload itself carries an optional {@code type} field. The consumer
 * group ({@code notification-service}) and JSON deserialization are configured
 * in {@code notification-service.yml} (served by config-server). Failed
 * records are re-delivered by the default Spring Kafka error handler; a poison
 * message therefore stays in the topic instead of silently vanishing.
 */
@Component
@RequiredArgsConstructor
public class NotificationConsumer {

    private static final Logger log = LoggerFactory.getLogger(NotificationConsumer.class);

    private final NotificationService notificationService;

    @KafkaListener(topics = "job-assigned")
    public void onJobAssigned(NotificationEvent event) {
        consume(event, NotificationType.JOB_ASSIGNED);
    }

    @KafkaListener(topics = "salary-slip-generated")
    public void onSalarySlipGenerated(NotificationEvent event) {
        consume(event, NotificationType.SALARY_SLIP_GENERATED);
    }

    @KafkaListener(topics = "performance-reviewed")
    public void onPerformanceReviewed(NotificationEvent event) {
        consume(event, NotificationType.PERFORMANCE_REVIEWED);
    }

    private void consume(NotificationEvent event, NotificationType topicType) {
        NotificationLog saved = notificationService.persistFromEvent(event, topicType);
        if (saved != null) {
            log.info("Consumed {} event: notification id={} for user {}",
                    topicType, saved.getId(), saved.getUserId());
        }
    }
}
