package com.domesticconnects.payroll;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

/**
 * Payroll microservice entry point.
 * <p>
 * Registers with Eureka via {@code spring-cloud-starter-netflix-eureka-client}
 * and resolves {@code @FeignClient} targets (attendance-service,
 * job-service) through the discovery registry.
 */
@SpringBootApplication
@EnableFeignClients
public class PayrollServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(PayrollServiceApplication.class, args);
    }
}
