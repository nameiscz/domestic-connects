package com.domesticconnects.auth.dto;

import com.domesticconnects.common.validation.ValidPassword;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResetPasswordRequest {

    @NotBlank(message = "Reset token is required")
    private String token;

    @ValidPassword
    private String newPassword;
}
