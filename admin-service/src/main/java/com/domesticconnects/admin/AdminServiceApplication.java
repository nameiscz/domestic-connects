package com.domesticconnects.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

/**
 * Admin microservice entry point.
 * <p>
 * Read-only dashboard aggregator. Resolves its {@code @FeignClient} targets
 * (auth-service, job-service, attendance-service, performance-service) through
 * Eureka, and guards every downstream call with Resilience4j circuit breakers
 * so dashboard endpoints degrade gracefully instead of failing outright.
 */
@SpringBootApplication
@EnableFeignClients
public class AdminServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdminServiceApplication.class, args);
    }
}
