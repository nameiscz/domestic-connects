package com.domesticconnects.admin.config;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

/**
 * OpenFeign configuration applied to <b>every admin-service Feign client</b>
 * (referenced via {@code @FeignClient(configuration = ...)}).
 * <p>
 * job-service, attendance-service and performance-service authorise their
 * endpoints via the {@code X-User-Role} header that the API gateway normally
 * forwards (see {@code JwtAuthGlobalFilter}). For direct service-to-service
 * calls — which bypass the gateway — each client presents admin-service as an
 * internal caller using the configurable {@code admin.internal-role}
 * (default {@code ADMIN}).
 * <p>
 * NOTE: intentionally <b>not</b> annotated with {@code @Configuration}. A
 * configuration class placed in the component-scanned base package would be
 * applied to every Feign client; referencing it explicitly per-client keeps
 * the role header scoped exactly where it is needed.
 */
public class AdminFeignConfig {

    @Bean
    public RequestInterceptor internalRoleInterceptor(
            @Value("${admin.internal-role:ADMIN}") String internalRole) {
        return template -> template.header("X-User-Role", internalRole);
    }
}
