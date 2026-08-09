# Notification Service

Consumes Kafka events published by other services and persists them as
notifications for domestic workers in MySQL.

## Responsibilities

- Consumes Kafka topics: `job-assigned` (job-service), `salary-slip-generated`
  (payroll-service), `performance-reviewed` (performance-service).
- Persists each event as a `NotificationLog` row
  (`id`, `user_id`, `message`, `type`, `is_read`, `created_at`).
- Exposes the user's inbox over REST through the API gateway.

## Endpoints (served at `/api/notifications/**` via the gateway)

| Method | Path                      | Description                               | Access                          |
|--------|---------------------------|-------------------------------------------|---------------------------------|
| GET    | `/notifications/{userId}` | List the user's notifications, newest first | owner or ADMIN                  |
| PATCH  | `/notifications/{id}/read`| Mark one notification as read             | owner of the notification or ADMIN |

Authorization relies on the `X-User-Id` / `X-User-Role` headers forwarded by
the API gateway's `JwtAuthGlobalFilter` — no Spring Security chain in-service.

## Kafka

Consumer group `notification-service` deserializes each record into
`NotificationEvent` (JSON) using Spring Kafka's `JsonDeserializer` with type
headers ignored, so producer DTOs never need to be on this service's classpath.
Broker, group and deserializer settings live in `config-repo/notification-service.yml`.

To create the topics (default: 1 partition, no replication for local dev):

```bash
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic job-assigned --partitions 1
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic salary-slip-generated --partitions 1
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic performance-reviewed --partitions 1
```

## Run

```bash
mvn spring-boot:run -pl notification-service
```

Requires config-server (port 8888), eureka-server (8761), MySQL
(`domestic_connects_notifications` per the config-repo default; `notification_db`
under Docker) and Kafka (localhost:9092 locally; `localhost:29092` on the Docker
host) to be up.
