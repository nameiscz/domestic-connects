package com.domesticconnects.payroll.config;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

/**
 * OpenFeign configuration scoped to the <b>attendance-service client only</b>
 * (referenced via {@code @FeignClient(configuration = ...)}).
 * <p>
 * attendance-service authorises its endpoints via the {@code X-User-Role}
 * header that the API gateway normally forwards (see {@code JwtAuthGlobalFilter}).
 * For direct service-to-service calls — which bypass the gateway — this client
 * presents payroll-service as an internal client using the configurable
 * {@code payroll.internal-role} (default {@code ADMIN}, which attendance-service
 * accepts).
 * <p>
 * NOTE: intentionally <b>not</b> annotated with {@code @Configuration}. A
 * configuration class placed in the component-scanned base package would be
 * applied to every Feign client; referencing it explicitly keeps the role
 * header off unrelated downstream calls (e.g. job-service, which needs none).
 */
public class AttendanceFeignConfig {

    @Bean
    public RequestInterceptor internalRoleInterceptor(
            @Value("${payroll.internal-role:ADMIN}") String internalRole) {
        return template -> template.header("X-User-Role", internalRole);
    }
}
