package com.domesticconnects.auth.dto;

import com.domesticconnects.common.validation.ValidPassword;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ChangePasswordRequest {

    @NotBlank(message = "Current password is required")
    private String currentPassword;

    @ValidPassword
    private String newPassword;
}
