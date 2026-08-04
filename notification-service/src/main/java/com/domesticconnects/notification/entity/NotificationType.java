package com.domesticconnects.notification.entity;

/**
 * The kind of event a notification was created from. The string value is sent
 * on the Kafka wire (or derived from the topic name) and persisted in the
 * {@code type} column of {@code notification_logs}.
 */
public enum NotificationType {
    /** A worker was assigned to a job post (topic {@code job-assigned}). */
    JOB_ASSIGNED,

    /** A monthly salary slip was generated for a worker (topic {@code salary-slip-generated}). */
    SALARY_SLIP_GENERATED,

    /** A performance review was submitted for a worker (topic {@code performance-reviewed}). */
    PERFORMANCE_REVIEWED
}
