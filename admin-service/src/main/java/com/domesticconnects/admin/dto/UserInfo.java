package com.domesticconnects.admin.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

/**
 * Mirror of {@code com.domesticconnects.auth.dto.AuthResponse.UserInfo} —
 * the user record returned by {@code GET /auth/admin/users}.
 * <p>
 * auth-service serializes its {@code boolean isVerified}/{@code isActive}
 * fields under the JavaBeans-derived names {@code "verified"}/{@code "active"}
 * (getters {@code isVerified()}/{@code isActive()}). These explicit
 * {@link JsonProperty} names pin that contract here so a future rename on
 * either side fails loudly instead of silently deserializing to {@code false}.
 */
@Data
@Builder
public class UserInfo {

    private Long id;
    private String name;
    private String email;
    private UserRole role;

    @JsonProperty("verified")
    private boolean isVerified;

    @JsonProperty("active")
    private boolean isActive;
}
