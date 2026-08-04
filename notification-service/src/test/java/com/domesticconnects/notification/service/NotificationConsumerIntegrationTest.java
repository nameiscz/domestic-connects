package com.domesticconnects.notification.service;

import com.domesticconnects.notification.dto.NotificationEvent;
import com.domesticconnects.notification.entity.NotificationLog;
import com.domesticconnects.notification.entity.NotificationType;
import com.domesticconnects.notification.repository.NotificationLogRepository;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end Kafka integration test: publishes JSON records to the three
 * notification topics on an in-process broker and verifies the real
 * {@link NotificationConsumer} + {@link JsonDeserializer} path deserializes
 * them and persists a {@link NotificationLog} to the (H2) database.
 * <p>
 * The consumer configuration mirrors production: type headers are ignored and
 * every record is decoded into {@link NotificationEvent} via
 * {@code spring.json.value.default.type}. A dedicated raw-JSON producer
 * simulates the other services' DTOs (whose {@code type} field is a String),
 * proving cross-service wire compatibility.
 */
@SpringBootTest(
        // EmbeddedKafkaBroker registers the broker addresses under this property.
        properties = {
                "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}",
                // The test application.yml disables auto-start; re-enable it here.
                "spring.kafka.listener.auto-startup=true",
                "spring.kafka.consumer.group-id=notification-service-it",
                "spring.kafka.consumer.auto-offset-reset=earliest",
                "spring.kafka.consumer.key-deserializer=org.apache.kafka.common.serialization.StringDeserializer",
                "spring.kafka.consumer.value-deserializer=org.springframework.kafka.support.serializer.JsonDeserializer",
                "spring.kafka.consumer.properties.spring.json.trusted.packages=*",
                "spring.kafka.consumer.properties.spring.json.value.default.type=com.domesticconnects.notification.dto.NotificationEvent",
                "spring.kafka.consumer.properties.spring.json.use.type.headers=false"
        })
@EmbeddedKafka(partitions = 1,
        topics = {"job-assigned", "salary-slip-generated", "performance-reviewed"})
@DisplayName("NotificationConsumer Kafka integration")
class NotificationConsumerIntegrationTest {

    @Autowired
    private EmbeddedKafkaBroker broker;

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    // ------------------------------------------------------------------
    // Tests — one per topic
    // ------------------------------------------------------------------

    @Test
    @DisplayName("job-assigned event without a type field is persisted as JOB_ASSIGNED (topic-derived type)")
    void consumesJobAssignedEventAndPersistsNotification() {
        NotificationEvent event = NotificationEvent.builder()
                .userId(10L)
                .message("You have been assigned to the job \"House Cleaning\" in Hyderabad.")
                .referenceId(1L)
                .timestamp(LocalDateTime.now())
                .build();

        producerTemplate().send("job-assigned", event);

        NotificationLog saved = awaitNotificationFor(10L);
        assertThat(saved.getType()).isEqualTo(NotificationType.JOB_ASSIGNED);
        assertThat(saved.getMessage()).isEqualTo(event.getMessage());
        assertThat(saved.isRead()).isFalse();
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    @DisplayName("salary-slip-generated event with an enum type round-trips through JSON")
    void consumesSalarySlipGeneratedEventWithEnumType() {
        NotificationEvent event = NotificationEvent.builder()
                .userId(11L)
                .type(NotificationType.SALARY_SLIP_GENERATED)
                .message("Your salary slip for 7/2026 has been generated.")
                .referenceId(42L)
                .timestamp(LocalDateTime.now())
                .build();

        producerTemplate().send("salary-slip-generated", event);

        NotificationLog saved = awaitNotificationFor(11L);
        assertThat(saved.getType()).isEqualTo(NotificationType.SALARY_SLIP_GENERATED);
        assertThat(saved.getMessage()).isEqualTo(event.getMessage());
    }

    @Test
    @DisplayName("producer-style JSON with a String type field deserializes into the enum")
    void consumesRawProducerPayloadWithStringType() {
        // Simulates a payload sent by performance-service's own NotificationEvent
        // DTO (type is a String there, not the consumer-side enum) — same wire shape.
        Map<String, Object> producerPayload = new HashMap<>();
        producerPayload.put("userId", 12L);
        producerPayload.put("type", "PERFORMANCE_REVIEWED");
        producerPayload.put("message", "A new performance review with rating 5/5 has been submitted for you.");
        producerPayload.put("referenceId", 7L);
        producerPayload.put("timestamp", LocalDateTime.now().toString());

        producerTemplate().send("performance-reviewed", producerPayload);

        NotificationLog saved = awaitNotificationFor(12L);
        assertThat(saved.getType()).isEqualTo(NotificationType.PERFORMANCE_REVIEWED);
        assertThat(saved.getMessage())
                .isEqualTo("A new performance review with rating 5/5 has been submitted for you.");
        assertThat(saved.isRead()).isFalse();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * Producer that serializes any value via {@link JsonSerializer} — used for
     * both typed {@link NotificationEvent} objects and raw maps mimicking the
     * other services' DTOs.
     */
    private KafkaTemplate<String, Object> producerTemplate() {
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(producerConfig()));
    }

    private Map<String, Object> producerConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, broker.getBrokersAsString());
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return config;
    }

    /**
     * Polls the repository until the consumer has persisted the notification
     * (the listener runs asynchronously on the broker), with a generous
     * deadline so the test fails deterministically rather than flakily.
     */
    private NotificationLog awaitNotificationFor(Long userId) {
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            Optional<NotificationLog> found = notificationLogRepository
                    .findByUserIdOrderByCreatedAtDesc(userId).stream().findFirst();
            if (found.isPresent()) {
                return found.get();
            }
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for notification", e);
            }
        }
        throw new AssertionError(
                "Notification for user " + userId + " was not persisted within 15s");
    }
}
