# domestic-connects

[![CI](https://github.com/nameiscz/domestic-connects/actions/workflows/ci.yml/badge.svg)](https://github.com/nameiscz/domestic-connects/actions/workflows/ci.yml)
![Java](https://img.shields.io/badge/Java-21-%23ED8B00)
[![License: MIT](https://img.shields.io/github/license/nameiscz/domestic-connects)](LICENSE)

DomesticConnect is a Java full-stack web application built with Spring Boot
Microservices (backend) and React + Vite (frontend) that helps families and
domestic workers.

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

## Repository layout

- `frontend/` — React (Vite) single-page app for workers, employers and admins
- `<service>/` — Spring Boot microservices (Maven reactor modules)
- `config-server/config-repo/` — centralised per-service configuration
- `docker/mysql/init/` — MySQL schema bootstrap
- `integration-tests/` — Postman/Newman API tests

## Run with Docker (full stack)

Requires Docker with Compose v2. Builds all 10 Java service images, starts MySQL
(creates the seven `<service>_db` schemas — `auth_db`, `job_db`, `attendance_db`,
`payroll_db`, `performance_db`, `admin_db` and `notification_db` — automatically)
and Kafka (Confluent, ZooKeeper-based metadata, with the `job-assigned`,
`salary-slip-generated` and `performance-reviewed` topics created up-front),
then boots the whole microservice fleet:

```bash
docker compose up --build        # first build takes several minutes (10 Maven images); add -d for detached
docker compose ps                # watch health/status
docker compose logs -f notification-service
docker compose down              # stop; use -v to also wipe MySQL/Kafka data
```

Then use the API through the gateway: `http://localhost:8080/api/**`
(e.g. `http://localhost:8080/api/notifications/1`). Kafka host tools reach the
broker at `localhost:29092`; in-network services use `kafka:9092`.

> Running services outside Docker instead? Start MySQL + Kafka + Redis (Redis is
> required by job-service and admin-service) with
> `docker compose up -d mysql redis kafka kafka-init`, then `mvn spring-boot:run`.
>
> Note the Docker MySQL is exposed on host port `3307` (3306 is usually taken on
> dev machines), while the config-repo local defaults point at `localhost:3306`
> with the legacy `domestic_connects_*` schemas. Either run a native MySQL on
> 3306, or override the datasource for each service, e.g.:
>
> ```bash
> SPRING_DATASOURCE_URL='jdbc:mysql://localhost:3307/domestic_connects_jobs?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC' \
>   mvn spring-boot:run -pl job-service
> ```
>
> For Kafka the in-network `kafka:9092` address is not resolvable on the host —
> override the bootstrap servers instead:
>
> ```bash
> KAFKA_BOOTSTRAP_SERVERS=localhost:29092 mvn spring-boot:run -pl notification-service
> ```

## Frontend (React)

```bash
cd frontend
npm install
npm run dev                # http://localhost:3000
```

The app talks to the API Gateway at `http://localhost:8080` by default
(CORS is configured for `http://localhost:3000`); override it with the
`VITE_API_BASE_URL` env var if the gateway runs elsewhere.

```bash
npm run test               # vitest unit tests
npm run lint               # eslint
npm run build              # production build to frontend/dist
```

## Run locally (no Docker)

1. Start MySQL, Redis and Kafka (or the containers above).
2. Start eureka-server, then config-server, then the services in any order:
   `mvn spring-boot:run -pl <service>` (config-server also needs
   `config-repo/` to be readable from its working directory).
