package com.domesticconnects.notification.service;

import com.domesticconnects.notification.dto.NotificationEvent;
import com.domesticconnects.notification.dto.NotificationResponse;
import com.domesticconnects.notification.entity.NotificationLog;
import com.domesticconnects.notification.entity.NotificationType;
import com.domesticconnects.notification.exception.AccessDeniedException;
import com.domesticconnects.notification.exception.ResourceNotFoundException;
import com.domesticconnects.notification.repository.NotificationLogRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationService")
class NotificationServiceTest {

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    @DisplayName("persistFromEvent should save a notification for the event's user and type")
    void persistFromEvent_savesNotification() {
        NotificationEvent event = NotificationEvent.builder()
                .userId(10L)
                .type(NotificationType.JOB_ASSIGNED)
                .message("You have been assigned to job 1")
                .build();
        NotificationLog saved = NotificationLog.builder()
                .id(1L).userId(10L).type(NotificationType.JOB_ASSIGNED)
                .message("You have been assigned to job 1").build();
        when(notificationLogRepository.save(any(NotificationLog.class))).thenReturn(saved);

        NotificationLog result = notificationService.persistFromEvent(event, NotificationType.JOB_ASSIGNED);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getUserId()).isEqualTo(10L);
        assertThat(result.isRead()).isFalse();

        ArgumentCaptor<NotificationLog> captor = ArgumentCaptor.forClass(NotificationLog.class);
        verify(notificationLogRepository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo(NotificationType.JOB_ASSIGNED);
        assertThat(captor.getValue().getMessage()).isEqualTo("You have been assigned to job 1");
    }

    @Test
    @DisplayName("persistFromEvent should fall back to the topic-derived type and a default message when fields are absent")
    void persistFromEvent_fallsBackToTopicTypeAndDefaultMessage() {
        NotificationEvent event = NotificationEvent.builder()
                .userId(10L)
                .build();
        when(notificationLogRepository.save(any(NotificationLog.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        NotificationLog result = notificationService.persistFromEvent(
                event, NotificationType.SALARY_SLIP_GENERATED);

        assertThat(result.getType()).isEqualTo(NotificationType.SALARY_SLIP_GENERATED);
        assertThat(result.getMessage()).isEqualTo("Your salary slip has been generated.");
    }

    @Test
    @DisplayName("persistFromEvent should skip events without a userId")
    void persistFromEvent_skipsEventWithoutUserId() {
        NotificationEvent event = NotificationEvent.builder()
                .message("orphaned")
                .build();

        NotificationLog result = notificationService.persistFromEvent(event, NotificationType.JOB_ASSIGNED);

        assertThat(result).isNull();
        verify(notificationLogRepository, never()).save(any(NotificationLog.class));
    }

    @Test
    @DisplayName("getNotificationsForUser should map repository rows to responses, newest first")
    void getNotificationsForUser_mapsRowsToResponses() {
        NotificationLog first = NotificationLog.builder()
                .id(1L).userId(10L).type(NotificationType.JOB_ASSIGNED)
                .message("Job assigned").build();
        NotificationLog second = NotificationLog.builder()
                .id(2L).userId(10L).type(NotificationType.PERFORMANCE_REVIEWED)
                .message("Review submitted").isRead(true).build();
        when(notificationLogRepository.findByUserIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of(second, first));

        List<NotificationResponse> responses = notificationService.getNotificationsForUser(10L);

        assertThat(responses).hasSize(2);
        assertThat(responses.get(0).getId()).isEqualTo(2L);
        assertThat(responses.get(0).isRead()).isTrue();
        assertThat(responses.get(1).getType()).isEqualTo(NotificationType.JOB_ASSIGNED);
    }

    @Test
    @DisplayName("markAsRead should set isRead on an unread notification owned by the caller")
    void markAsRead_marksUnreadNotification() {
        NotificationLog notification = NotificationLog.builder()
                .id(1L).userId(10L).type(NotificationType.JOB_ASSIGNED)
                .message("Job assigned").build();
        when(notificationLogRepository.findById(1L)).thenReturn(Optional.of(notification));

        NotificationResponse response = notificationService.markAsRead(1L, 10L);

        assertThat(response.isRead()).isTrue();
        assertThat(notification.isRead()).isTrue();
        // The entity is managed — the update is flushed by dirty checking, no save() call.
        verify(notificationLogRepository, never()).save(any(NotificationLog.class));
    }

    @Test
    @DisplayName("markAsRead should reject a caller who does not own the notification")
    void markAsRead_deniesNonOwner() {
        NotificationLog notification = NotificationLog.builder()
                .id(1L).userId(10L).type(NotificationType.JOB_ASSIGNED)
                .message("Job assigned").build();
        when(notificationLogRepository.findById(1L)).thenReturn(Optional.of(notification));

        assertThatThrownBy(() -> notificationService.markAsRead(1L, 99L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("own notifications");
        assertThat(notification.isRead()).isFalse();
    }

    @Test
    @DisplayName("markAsRead should be idempotent for an already-read notification")
    void markAsRead_idempotentWhenAlreadyRead() {
        NotificationLog notification = NotificationLog.builder()
                .id(1L).userId(10L).type(NotificationType.JOB_ASSIGNED)
                .message("Job assigned").isRead(true).build();
        when(notificationLogRepository.findById(1L)).thenReturn(Optional.of(notification));

        NotificationResponse response = notificationService.markAsRead(1L, null);

        assertThat(response.isRead()).isTrue();
        verify(notificationLogRepository, never()).save(any(NotificationLog.class));
    }

    @Test
    @DisplayName("markAsRead should fail with 404 when the notification does not exist")
    void markAsRead_throwsWhenMissing() {
        when(notificationLogRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markAsRead(99L, null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }
}
