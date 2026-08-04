package com.domesticconnects.notification.service;

import com.domesticconnects.notification.dto.NotificationEvent;
import com.domesticconnects.notification.entity.NotificationLog;
import com.domesticconnects.notification.entity.NotificationType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationConsumer")
class NotificationConsumerTest {

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private NotificationConsumer notificationConsumer;

    private NotificationEvent event() {
        return NotificationEvent.builder().userId(10L).message("Hello").build();
    }

    @Test
    @DisplayName("onJobAssigned should persist the event as JOB_ASSIGNED")
    void onJobAssigned_delegatesWithJobAssignedType() {
        NotificationEvent event = event();
        when(notificationService.persistFromEvent(same(event), eq(NotificationType.JOB_ASSIGNED)))
                .thenReturn(NotificationLog.builder().id(1L).userId(10L).build());

        notificationConsumer.onJobAssigned(event);

        verify(notificationService).persistFromEvent(same(event), eq(NotificationType.JOB_ASSIGNED));
    }

    @Test
    @DisplayName("onSalarySlipGenerated should persist the event as SALARY_SLIP_GENERATED")
    void onSalarySlipGenerated_delegatesWithSalarySlipGeneratedType() {
        NotificationEvent event = event();
        when(notificationService.persistFromEvent(same(event), eq(NotificationType.SALARY_SLIP_GENERATED)))
                .thenReturn(NotificationLog.builder().id(2L).userId(10L).build());

        notificationConsumer.onSalarySlipGenerated(event);

        verify(notificationService).persistFromEvent(same(event), eq(NotificationType.SALARY_SLIP_GENERATED));
    }

    @Test
    @DisplayName("onPerformanceReviewed should persist the event as PERFORMANCE_REVIEWED")
    void onPerformanceReviewed_delegatesWithPerformanceReviewedType() {
        NotificationEvent event = event();
        when(notificationService.persistFromEvent(same(event), eq(NotificationType.PERFORMANCE_REVIEWED)))
                .thenReturn(NotificationLog.builder().id(3L).userId(10L).build());

        notificationConsumer.onPerformanceReviewed(event);

        verify(notificationService).persistFromEvent(same(event), eq(NotificationType.PERFORMANCE_REVIEWED));
    }
}
