package com.domesticconnects.auth.controller;

import com.domesticconnects.auth.dto.ApiResponse;
import com.domesticconnects.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth/admin/users")
@RequiredArgsConstructor
public class AdminController {

    private final AuthService authService;

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> activateUser(@PathVariable Long id) {
        ApiResponse<Void> response = authService.activateUser(id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(@PathVariable Long id) {
        ApiResponse<Void> response = authService.deactivateUser(id);
        return ResponseEntity.ok(response);
    }
}
