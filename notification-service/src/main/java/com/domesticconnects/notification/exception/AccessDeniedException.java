package com.domesticconnects.notification.exception;

/**
 * Thrown when the caller's identity/role (from the X-User-* headers forwarded
 * by the gateway) does not grant access to an endpoint. Mapped to HTTP 403.
 */
public class AccessDeniedException extends RuntimeException {

    public AccessDeniedException(String message) {
        super(message);
    }
}
