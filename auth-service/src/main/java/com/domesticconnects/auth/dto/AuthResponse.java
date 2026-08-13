package com.domesticconnects.auth.dto;

import com.domesticconnects.auth.entity.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private long expiresIn;
    private UserInfo user;

    @Data
    @Builder
    public static class UserInfo {
        private Long id;
        private String name;
        private String email;
        private Role role;
        private boolean isActive;
    }
}
