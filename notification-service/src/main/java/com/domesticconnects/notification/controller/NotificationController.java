package com.domesticconnects.notification.controller;

import com.domesticconnects.notification.dto.NotificationResponse;
import com.domesticconnects.notification.exception.AccessDeniedException;
import com.domesticconnects.notification.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Notification endpoints. Authentication is performed by the API gateway,
 * which forwards the caller's user id and role in the {@code X-User-Id} and
 * {@code X-User-Role} headers (see {@code JwtAuthGlobalFilter}). Users may only
 * read/mark their own notifications; admins may access any. No Spring Security
 * filter chain exists in this service.
 */
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private static final String ROLE_ADMIN = "ADMIN";

    private final NotificationService notificationService;

    /**
     * Returns a user's notification inbox (newest first).
     */
    @GetMapping("/{userId}")
    public ResponseEntity<List<NotificationResponse>> getUserNotifications(
            @PathVariable Long userId,
            HttpServletRequest httpRequest) {
        requireOwnerOrAdmin(httpRequest, userId);
        return ResponseEntity.ok(notificationService.getNotificationsForUser(userId));
    }

    /**
     * Marks a single notification as read. Admins pass {@code null} to the
     * service (bypassing the ownership check); everyone else must own the
     * notification, enforced by the service in the same transaction.
     */
    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        if (isAdmin(httpRequest)) {
            return ResponseEntity.ok(notificationService.markAsRead(id, null));
        }
        Long callerId = extractUserId(httpRequest);
        if (callerId == null) {
            // Fail closed: a missing/unparseable X-User-Id never bypasses ownership.
            throw new AccessDeniedException(
                    "Access denied: you can only access your own notifications");
        }
        return ResponseEntity.ok(notificationService.markAsRead(id, callerId));
    }

    /**
     * True when the caller's role is ADMIN (from the gateway-forwarded header).
     */
    private boolean isAdmin(HttpServletRequest request) {
        return ROLE_ADMIN.equalsIgnoreCase(extractUserRole(request));
    }

    /**
     * Verifies the caller is either an admin or the notification's owner.
     * {@link AccessDeniedException} (HTTP 403) is thrown otherwise.
     */
    private void requireOwnerOrAdmin(HttpServletRequest request, Long resourceOwnerId) {
        String role = extractUserRole(request);
        if (role.equalsIgnoreCase(ROLE_ADMIN)) {
            return;
        }
        Long callerId = extractUserId(request);
        if (callerId != null && callerId.equals(resourceOwnerId)) {
            return;
        }
        throw new AccessDeniedException(
                "Access denied: you can only access your own notifications");
    }

    /**
     * Reads the caller's role. The gateway forwards it as {@code X-User-Role};
     * {@code X-User-Roles} is tolerated as a fallback for older gateway builds.
     * A missing header yields an empty string so the caller is treated as
     * unauthenticated.
     */
    private String extractUserRole(HttpServletRequest request) {
        String role = request.getHeader("X-User-Role");
        if (role == null || role.isBlank()) {
            role = request.getHeader("X-User-Roles");
        }
        return role == null ? "" : role.trim();
    }

    /**
     * Reads the caller's user id from the gateway-forwarded {@code X-User-Id}
     * header. Returns {@code null} when absent or not numeric, so ownership
     * checks fail closed.
     */
    private Long extractUserId(HttpServletRequest request) {
        String userId = request.getHeader("X-User-Id");
        if (userId == null || userId.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(userId.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
