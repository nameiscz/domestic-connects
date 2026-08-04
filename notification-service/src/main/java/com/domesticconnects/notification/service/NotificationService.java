package com.domesticconnects.notification.service;

import com.domesticconnects.notification.dto.NotificationEvent;
import com.domesticconnects.notification.dto.NotificationResponse;
import com.domesticconnects.notification.entity.NotificationLog;
import com.domesticconnects.notification.entity.NotificationType;
import com.domesticconnects.notification.exception.AccessDeniedException;
import com.domesticconnects.notification.exception.ResourceNotFoundException;
import com.domesticconnects.notification.repository.NotificationLogRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationLogRepository notificationLogRepository;

    /**
     * Persists a notification from a Kafka event. The type is taken from the
     * event when present, otherwise the topic-derived fallback (supplied by
     * the consumer) is used. Returns {@code null} when the event is not
     * actionable (missing user id), in which case the consumer logs and acks.
     */
    @Transactional
    public NotificationLog persistFromEvent(NotificationEvent event, NotificationType fallbackType) {
        if (event == null || event.getUserId() == null) {
            log.warn("Skipping notification event: missing or null userId");
            return null;
        }

        NotificationType type = event.getType() != null ? event.getType() : fallbackType;
        String message = (event.getMessage() == null || event.getMessage().isBlank())
                ? defaultMessage(type)
                : event.getMessage().trim();

        NotificationLog notification = NotificationLog.builder()
                .userId(event.getUserId())
                .message(message)
                .type(type)
                .build();

        NotificationLog saved = notificationLogRepository.save(notification);

        log.info("Notification persisted for user {} (type={}, id={})",
                saved.getUserId(), saved.getType(), saved.getId());
        return saved;
    }

    /**
     * Returns a user's inbox, newest first.
     */
    @Transactional(readOnly = true)
    public List<NotificationResponse> getNotificationsForUser(Long userId) {
        return notificationLogRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Marks a notification as read in a single transaction, verifying
     * ownership at the same time. {@code ownerUserId} is the caller's id from
     * the gateway-forwarded {@code X-User-Id} header; when non-null it must
     * match the notification's owner or {@link AccessDeniedException} (HTTP 403)
     * is thrown. Admins pass {@code null} to bypass the check. Idempotent — an
     * already-read notification is returned unchanged.
     */
    @Transactional
    public NotificationResponse markAsRead(Long id, Long ownerUserId) {
        NotificationLog notification = findNotification(id);
        if (ownerUserId != null && !ownerUserId.equals(notification.getUserId())) {
            throw new AccessDeniedException(
                    "Access denied: you can only access your own notifications");
        }
        if (!notification.isRead()) {
            // The entity is managed, so dirty checking flushes the change on commit.
            notification.setRead(true);
        }
        return toResponse(notification);
    }

    private NotificationLog findNotification(Long id) {
        return notificationLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", "id", id));
    }

    private String defaultMessage(NotificationType type) {
        return switch (type) {
            case JOB_ASSIGNED -> "You have been assigned to a new job.";
            case SALARY_SLIP_GENERATED -> "Your salary slip has been generated.";
            case PERFORMANCE_REVIEWED -> "A new performance review has been submitted for you.";
        };
    }

    private NotificationResponse toResponse(NotificationLog notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .userId(notification.getUserId())
                .message(notification.getMessage())
                .type(notification.getType())
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
