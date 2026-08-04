# Admin Service

Read-only admin dashboard microservice that aggregates data from the other
Domestic Connects services over OpenFeign, with every downstream call guarded
by a Resilience4j circuit breaker with graceful fallbacks.

## Endpoints

All routes are served under `/admin/**` and reachable from the API gateway at
`/api/admin/**` (e.g. `GET /api/admin/dashboard/summary`).

| Endpoint                        | Description                                                              |
|---------------------------------|--------------------------------------------------------------------------|
| `GET /admin/dashboard/summary`  | Total/active users, total/active/inactive jobs, this month's attendance rate, average performance rating |
| `GET /admin/users`              | All registered users (from auth-service)                                |
| `GET /admin/jobs`               | All job posts (from job-service)                                        |
| `GET /admin/dashboard/analytics`| Users by role, jobs by status, active vs inactive jobs, monthly attendance rate, average rating |

## Downstream integration (OpenFeign + Resilience4j)

| Circuit        | Feign client              | Downstream call                                   |
|----------------|---------------------------|---------------------------------------------------|
| `authService`      | `AuthServiceClient`       | `GET /auth/admin/users`                           |
| `jobService`       | `JobServiceClient`        | `GET /jobs`                                       |
| `attendanceService`| `AttendanceServiceClient` | `GET /attendance/workers`, `GET /attendance/worker/{id}` |
| `performanceService` | `PerformanceServiceClient` | `GET /performance/worker/{id}`                    |

- Every client injects an `X-User-Role: ADMIN` header (see `AdminFeignConfig`)
  so downstream role-checked endpoints accept the internal call.
- Each guarded method in `AdminService` has a fallback returning a safe default
  (empty list / `null`), so an unhealthy service degrades the dashboard rather
  than failing it.
- Circuit breaker settings live in `config-repo/admin-service.yml` under
  `resilience4j.circuitbreaker.instances`.

## Run

Needs config-server (8888) and Eureka (8761) running, then:

```bash
mvn -pl admin-service spring-boot:run
```

Registers with Eureka as `admin-service` on port `8086`.
