package com.domesticconnects.gateway.config;

import org.springframework.context.annotation.Configuration;

/**
 * CORS configuration is managed declaratively via the
 * {@code spring.cloud.gateway.globalcors} properties in
 * {@code api-gateway.yml} (served by config-server).
 * <p>
 * This class is intentionally empty.  The YAML-based {@code globalcors}
 * block is the single source of truth for CORS settings.  Uncomment the
 * {@link org.springframework.web.cors.reactive.CorsWebFilter} bean below
 * only if runtime/dynamic CORS logic is required.
 */
@Configuration
public class CorsConfig {
    // CORS is configured via spring.cloud.gateway.globalcors in api-gateway.yml
}
