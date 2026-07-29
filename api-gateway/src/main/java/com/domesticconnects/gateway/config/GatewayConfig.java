package com.domesticconnects.gateway.config;

import org.springframework.context.annotation.Configuration;

/**
 * Placeholder for programmatic route definitions.
 * <p>
 * All routes are managed centrally in {@code api-gateway.yml} (served by config-server).
 * Uncomment and extend this class when advanced predicate or filter logic
 * (difficult to express in YAML) is needed.
 *
 * <pre>{@code
 * @Bean
 * public RouteLocator supplementalRoutes(RouteLocatorBuilder builder) {
 *     return builder.routes()
 *         .route("custom-route", r -> r
 *             .path("/api/custom/**")
 *             .filters(f -> f.retry(3))
 *             .uri("lb://custom-service"))
 *         .build();
 * }
 * }</pre>
 */
@Configuration
public class GatewayConfig {
    // All routes are defined in config-repo/api-gateway.yml
}
