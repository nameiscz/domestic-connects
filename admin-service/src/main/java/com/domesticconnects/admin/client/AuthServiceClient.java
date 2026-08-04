package com.domesticconnects.admin.client;

import com.domesticconnects.admin.config.AdminFeignConfig;
import com.domesticconnects.admin.dto.ApiResponse;
import com.domesticconnects.admin.dto.UserInfo;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

/**
 * OpenFeign client for auth-service. Resolved through Eureka by service name.
 * <p>
 * The {@code GET /auth/admin/users} endpoint was added to auth-service
 * specifically to serve the admin dashboard; the caller is identified via the
 * {@code X-User-Role} header that {@link AdminFeignConfig} injects.
 */
@FeignClient(name = "auth-service", configuration = AdminFeignConfig.class)
public interface AuthServiceClient {

    @GetMapping("/auth/admin/users")
    ApiResponse<List<UserInfo>> getAllUsers();
}
