package com.domesticconnects.notification.dto;

import com.domesticconnects.notification.entity.NotificationType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * API representation of a {@code NotificationLog} row.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponse {

    private Long id;
    private Long userId;
    private String message;
    private NotificationType type;

    /**
     * Lombok names the getter {@code isRead()}, which Jackson would otherwise
     * serialize as {@code "read"}; this keeps the wire field {@code isRead}
     * matching the entity column and API contract.
     */
    @JsonProperty("isRead")
    private boolean isRead;

    private LocalDateTime createdAt;
}
