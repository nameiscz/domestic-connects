package com.domesticconnects.admin.exception;

/**
 * Thrown when a caller is not permitted to access an admin endpoint
 * (mapped to HTTP 403 by {@link GlobalExceptionHandler}).
 */
public class AccessDeniedException extends RuntimeException {

    public AccessDeniedException(String message) {
        super(message);
    }
}
