package com.domesticconnects.payroll.service;

import com.domesticconnects.payroll.dto.NotificationEvent;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Publishes the {@code salary-slip-generated} notification event whenever a
 * salary slip is generated for a worker (single-slip and batch flows alike).
 * Publishing is <b>best-effort</b>: a Kafka outage or serialization failure is
 * logged and swallowed so slip generation itself never fails — the notification
 * consumer simply won't see the event.
 */
@Component
@RequiredArgsConstructor
public class NotificationPublisher {

    private static final Logger log = LoggerFactory.getLogger(NotificationPublisher.class);

    private static final String TOPIC_SALARY_SLIP_GENERATED = "salary-slip-generated";
    private static final String TYPE_SALARY_SLIP_GENERATED = "SALARY_SLIP_GENERATED";

    private final KafkaTemplate<String, NotificationEvent> kafkaTemplate;

    /**
     * Emits a {@code salary-slip-generated} event for the given worker/record.
     *
     * @param workerId  the worker the slip was generated for
     * @param recordId  the persisted salary record id
     * @param month     slip period month (1-12)
     * @param year      slip period year
     */
    public void publishSlipGenerated(Long workerId, Long recordId, int month, int year) {
        NotificationEvent event = NotificationEvent.builder()
                .userId(workerId)
                .type(TYPE_SALARY_SLIP_GENERATED)
                .message("Your salary slip for " + month + "/" + year + " is ready to download.")
                .referenceId(recordId)
                .timestamp(LocalDateTime.now())
                .build();

        try {
            kafkaTemplate.send(TOPIC_SALARY_SLIP_GENERATED, String.valueOf(workerId), event)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.warn("Failed to publish salary-slip-generated event for worker {} record {}: {}",
                                    workerId, recordId, ex.getMessage());
                        }
                    });
        } catch (Exception e) {
            log.warn("Failed to publish salary-slip-generated event for worker {} record {}: {}",
                    workerId, recordId, e.getMessage());
        }
    }
}
