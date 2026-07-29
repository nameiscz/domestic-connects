package com.domesticconnects.configserver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.config.server.EnableConfigServer;

/**
 * Config Server — Centralised configuration for Domestic Connects microservices.
 * <p>
 * Serves configuration from the local {@code config-repo/} directory using the
 * native profile. Registers itself with Eureka for service discovery.
 */
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ConfigServerApplication.class, args);
    }
}
