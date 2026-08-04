# domestic-connects
DomesticConnect is a Java Full Stack web application built using Spring Boot Microservices that helps families and domestic workers.

## Architecture

| Service               | Port  | Notes                                        |
|-----------------------|-------|----------------------------------------------|
| api-gateway           | 8080  | Entry point; JWT validation + routing        |
| auth-service          | 8081  | Users, roles, JWT issuance                   |
| job-service           | 8082  | Job postings                                 |
| attendance-service    | 8083  | Daily attendance                             |
| payroll-service       | 8084  | Salary slips (PDF)                           |
| performance-service   | 8085  | Worker reviews                               |
| admin-service         | 8086  | Aggregated admin dashboard                   |
| notification-service  | 8087  | Kafka → MySQL notifications                  |
| config-server         | 8888  | Central config (config-repo/)                |
| eureka-server         | 8761  | Service discovery                            |

## Run with Docker (full stack)

Requires Docker with Compose v2. Builds all 10 images, starts MySQL (creates the
six `domestic_connects_*` databases automatically) and Kafka (KRaft, with the
`job-assigned`, `salary-slip-generated` and `performance-reviewed` topics created
up-front), then boots the whole microservice fleet:

```bash
docker compose up --build        # first build takes several minutes (10 Maven images); add -d for detached
docker compose ps                # watch health/status
docker compose logs -f notification-service
docker compose down              # stop; use -v to also wipe MySQL/Kafka data
```

Then use the API through the gateway: `http://localhost:8080/api/**`
(e.g. `http://localhost:8080/api/notifications/1`). Kafka host tools reach the
broker at `localhost:29092`; in-network services use `kafka:9092`.

> Running services outside Docker instead? Start MySQL + Kafka with
> `docker compose up -d mysql kafka kafka-init`, then `mvn spring-boot:run`.
> MySQL is reachable at `localhost:3306` (default). For Kafka the in-network
> `kafka:9092` address is not resolvable on the host — override the bootstrap
> servers instead:
>
> ```bash
> KAFKA_BOOTSTRAP_SERVERS=localhost:29092 mvn spring-boot:run -pl notification-service
> ```

## Run locally (no Docker)

1. Start MySQL and Kafka (or the containers above).
2. Start eureka-server, then config-server, then the services in any order:
   `mvn spring-boot:run -pl <service>` (config-server also needs
   `config-repo/` to be readable from its working directory).
