# Eureka Server — Service Discovery

This module is a **Spring Cloud Netflix Eureka Server** that acts as the
service registry for the Domestic Connects microservices ecosystem.

All other microservices (API Gateway, business services, etc.) register
themselves with this server and discover each other through it.

---

## Tech Stack

| Layer    | Technology                                            |
|----------|-------------------------------------------------------|
| Runtime  | Java 21                                               |
| Framework| Spring Boot 3.2.5                                     |
| Cloud    | Spring Cloud 2023.0.1 (Leyton)                        |
| Registry | Netflix Eureka (spring-cloud-starter-netflix-eureka-server) |

---

## How to Build & Run

### Prerequisites

- JDK 21
- Apache Maven 3.9+

### Build

```bash
# From the project root
mvn clean package

# Or build only this module
mvn clean package -pl eureka-server -am
```

### Run

```bash
# From the project root
mvn spring-boot:run -pl eureka-server

# Or via java -jar after building
java -jar eureka-server/target/eureka-server-*.jar
```

---

## Endpoints

| Endpoint              | Description                                 |
|-----------------------|---------------------------------------------|
| `http://localhost:8761/`      | Eureka Dashboard (HTML UI)    |
| `http://localhost:8761/eureka/apps` | Eureka REST API — list all registered instances (JSON/XML) |

---

## Configuration Highlights

| Property                                            | Value    | Reason                                  |
|-----------------------------------------------------|----------|-----------------------------------------|
| `eureka.client.register-with-eureka`                | `false`  | Standalone server — don't self-register |
| `eureka.client.fetch-registry`                      | `false`  | Standalone server — no replica to clone |
| `eureka.server.enable-self-preservation`             | `false`  | Disabled for dev (enable in production) |
| `eureka.server.eviction-interval-timer-in-ms`        | `5000`   | Evict stale instances every 5 seconds   |

> ⚠️ **Self-preservation** is a safety net that prevents Eureka from
> evicting instances during network partitions. Disable it only in dev
> so instances are removed promptly when you stop them. Enable it
> (`true` — the default) in production.

---

## Registering a Client

Add the following to any Spring Boot microservice that should register
with this Eureka server:

**pom.xml**
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

**application.yml**
```yaml
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
```

Then start both the Eureka Server and your service. Within ~30 seconds
the service appears in the Eureka Dashboard.

---

## HA / Peer-Aware Mode (Production)

For production, run **at least two** Eureka servers pointing at each
other. See the
[Spring Cloud documentation](https://cloud.spring.io/spring-cloud-netflix/reference/html/)
for peer awareness setup.
