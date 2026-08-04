package com.domesticconnects.notification.repository;

import com.domesticconnects.notification.entity.NotificationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for {@link NotificationLog}.
 */
@Repository
public interface NotificationLogRepository extends JpaRepository<NotificationLog, Long> {

    /**
     * All notifications for a user, newest first. The user's notification
     * inbox is rendered in reverse chronological order.
     */
    List<NotificationLog> findByUserIdOrderByCreatedAtDesc(Long userId);
}
