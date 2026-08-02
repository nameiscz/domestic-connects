package com.domesticconnects.attendance.exception;

/**
 * Thrown when attendance is marked twice for the same worker + date.
 * Mapped to HTTP 409 Conflict.
 */
public class DuplicateAttendanceException extends RuntimeException {

    public DuplicateAttendanceException(String message) {
        super(message);
    }
}
