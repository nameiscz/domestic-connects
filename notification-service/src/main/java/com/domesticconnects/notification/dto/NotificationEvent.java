package com.domesticconnects.notification.dto;

import com.domesticconnects.notification.entity.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Wire payload for the notification Kafka topics ({@code job-assigned},
 * {@code salary-slip-generated}, {@code performance-reviewed}).
 * <p>
 * Producers in job-service, payroll-service and performance-service publish a
 * JSON body with the <b>same field names</b> (see their {@code NotificationEvent}
 * DTOs); the consumer deserializes it into this class. {@code type} is optional
 * — when absent the consumer infers it from the topic the record arrived on.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEvent {

    /** Recipient user id (the worker the event is about). */
    private Long userId;

    /** Optional event kind; falls back to the topic-derived type when null. */
    private NotificationType type;

    /** Human-readable message body stored on the notification. */
    private String message;

    /** Optional id of the originating record (job post, salary record, review). */
    private Long referenceId;

    /** When the event was produced. */
    private LocalDateTime timestamp;
}
