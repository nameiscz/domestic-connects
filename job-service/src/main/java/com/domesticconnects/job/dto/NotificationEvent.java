package com.domesticconnects.job.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Wire payload published to the {@code job-assigned} Kafka topic.
 * <p>
 * Field names deliberately match {@code NotificationEvent} in notification-service
 * (which deserializes with type headers disabled), so the consumer can decode
 * this record without any shared classpath dependency. {@code type} is a plain
 * string matching the consumer's {@code NotificationType} enum values.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEvent {

    /** Recipient user id (the worker the event is about). */
    private Long userId;

    /** Event kind as a string, e.g. {@code JOB_ASSIGNED}. */
    private String type;

    /** Human-readable message body stored on the notification. */
    private String message;

    /** Optional id of the originating record (the job post). */
    private Long referenceId;

    /** When the event was produced. */
    private LocalDateTime timestamp;
}
