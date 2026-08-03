package com.domesticconnects.performance.exception;

/**
 * Thrown when a requested resource (e.g. a performance review) does not exist.
 * Mapped to HTTP 404.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String resourceName, String fieldName, Object fieldValue) {
        super(String.format("%s not found with %s: '%s'", resourceName, fieldName, fieldValue));
    }
}
