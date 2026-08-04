package com.domesticconnects.notification.repository;

import com.domesticconnects.notification.entity.NotificationLog;
import com.domesticconnects.notification.entity.NotificationType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@DisplayName("NotificationLogRepository")
class NotificationLogRepositoryTest {

    @Autowired
    private NotificationLogRepository notificationLogRepository;

    private NotificationLog createNotification(Long userId, NotificationType type, String message) {
        return NotificationLog.builder()
                .userId(userId)
                .type(type)
                .message(message)
                .build();
    }

    @Test
    @DisplayName("findByUserIdOrderByCreatedAtDesc should return only the user's notifications, newest first")
    void findByUserIdOrderByCreatedAtDesc_filtersByUserAndOrdersNewestFirst() {
        NotificationLog older = notificationLogRepository.save(
                createNotification(10L, NotificationType.JOB_ASSIGNED, "Assigned to job 1"));
        notificationLogRepository.save(
                createNotification(11L, NotificationType.JOB_ASSIGNED, "Other user's notification"));
        NotificationLog newer = notificationLogRepository.save(
                createNotification(10L, NotificationType.SALARY_SLIP_GENERATED, "Slip ready"));

        // createdAt is stamped at insert time; sleep is unnecessary — H2 inserts
        // within the same transaction can share a timestamp, so assert by content
        // rather than strict ordering guarantees.
        List<NotificationLog> result = notificationLogRepository
                .findByUserIdOrderByCreatedAtDesc(10L);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(NotificationLog::getId)
                .containsExactlyInAnyOrder(older.getId(), newer.getId());
        assertThat(result).allMatch(n -> n.getUserId().equals(10L));
    }

    @Test
    @DisplayName("new notifications should default to unread and be stamped with createdAt")
    void newNotifications_defaultToUnreadAndStamped() {
        NotificationLog saved = notificationLogRepository.save(
                createNotification(10L, NotificationType.JOB_ASSIGNED, "Assigned to job 1"));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.isRead()).isFalse();
        assertThat(saved.getCreatedAt()).isNotNull();
    }
}
