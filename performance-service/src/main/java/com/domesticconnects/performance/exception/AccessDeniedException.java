package com.domesticconnects.performance.exception;

/**
 * Thrown when the caller's role (from the X-User-Role header forwarded by the
 * gateway) does not grant access to an endpoint. Mapped to HTTP 403.
 */
public class AccessDeniedException extends RuntimeException {

    public AccessDeniedException(String message) {
        super(message);
    }
}
