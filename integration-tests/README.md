# Domestic Connects — Worker Lifecycle Integration Tests

A Postman/Newman-runnable integration suite that exercises the **entire worker
lifecycle** through the API gateway (`http://localhost:8080/api/**`), across
all seven microservices: auth, jobs, attendance, payroll, performance,
notifications and the admin dashboard.

```
integration-tests/
├── README.md                                     <- this file
├── postman/
│   └── domestic-connects-worker-lifecycle.postman_collection.json   <- 8 folders / 46 requests
└── scripts/
    ├── run-newman.sh                             <- one-command runner (3 phases)
    ├── fetch-verification-tokens.sh              <- extracts email tokens from MySQL
    └── publish-notification-events.sh            <- simulates the Kafka notification producers
```

## What is covered

| # | Requested scenario                          | Collection folder                                  |
|---|---------------------------------------------|-----------------------------------------------------|
| 1 | Register worker + employer (+admin), verify, activate | `0. Register Accounts`, `1. Verify, Login & Activate` |
| 2 | Employer posts a job                        | `2. Job Posting & Assignment`                       |
| 3 | Worker assigned to the job                  | `2. Job Posting & Assignment`                       |
| 4 | Attendance marked for several days          | `3. Attendance` (3 PRESENT + 1 HALF_DAY + 1 ABSENT, duplicate → 409) |
| 5 | Salary slip generated & downloaded          | `4. Salary Slip & Payroll` (PDF + history + CSV + batch ZIP) |
| 6 | Performance review submitted                | `5. Performance Review` (submit, read, own-read, update, 403s) |
| 7 | Notification for each triggering event      | `6. Notifications` (JOB_ASSIGNED, SALARY_SLIP_GENERATED, PERFORMANCE_REVIEWED) |
| 8 | Admin dashboard analytics reflect all       | `7. Admin Dashboard` (summary, analytics, users, 403 for non-admin) |

The suite also asserts the important negative cases (401/403/404/409) so
authorisation and uniqueness rules are verified, not just the happy path.

## Prerequisites

- The full stack running: `docker compose up --build -d` (from the repo root).
  This starts MySQL, Redis, Kafka, Eureka, config-server, the gateway and all
  7 services. Wait until `docker compose ps` shows the services healthy.
- [Newman](https://learning.postman.com/docs/collections/running-collections/newman-command-line/)
  (`npm install -g newman`) — required for the automated runner.
- `node` (ships with Newman), `docker`, and either the `mysql` CLI **or** the
  `domestic-connects-mysql` container (the token script falls back to
  `docker exec`).

## Quick start (one command)

```bash
docker compose up --build -d          # once, from the repo root
./integration-tests/scripts/run-newman.sh
```

The runner performs three phases automatically:

1. **Register** — runs folder `0. Register Accounts` (creates a WORKER, an
   EMPLOYER and an ADMIN with unique emails) and exports the run variables.
2. **Verify & lifecycle** — extracts the email-verification tokens from MySQL
   and runs folders `1–5` (verify → login → deactivate/reactivate → jobs →
   attendance → salary slip → performance review).
3. **Notify & report** — publishes the three Kafka notification events for the
   worker, waits for the consumer, then runs folders `6–7` (notifications →
   admin dashboard).

On success you see `SUCCESS: full worker lifecycle covered end-to-end.` and a
green newman summary. Re-running is safe: every run uses fresh unique emails.

## Why the helper scripts exist (the remaining gap)

The suite stays faithful to what the platform actually does — and works around
the one gap that would otherwise block an end-to-end run:

1. **No mailer configured by default → verification tokens live only in
   MySQL.** `register` stores a random token in the `users` table; without a
   `RESEND_API_KEY` the verification link is only logged by auth-service (and
   there is no email service to deliver it). `fetch-verification-tokens.sh`
   reads it straight from the auth DB:

   ```bash
   # machine mode (used by run-newman.sh)
   ./scripts/fetch-verification-tokens.sh --from-export /tmp/domestic-connects-it/vars.json \
                                          --out /tmp/domestic-connects-it/env-with-tokens.json

   # manual mode (Postman UI) — emails in worker, employer, admin order
   ./scripts/fetch-verification-tokens.sh \
     --emails worker.1752@it.domesticconnects.local,employer.1752@it.domesticconnects.local,admin.1752@it.domesticconnects.local
   ```

   Set `RESEND_API_KEY` on the auth-service (docker-compose) to send real
   verification emails instead.

2. **Notifications are now event-driven for real.** job-service,
   payroll-service and performance-service publish `job-assigned`,
   `salary-slip-generated` and `performance-reviewed` events through their own
   `KafkaTemplate`s (best-effort — a broker outage never fails the business
   operation). Folder `6. Notifications` therefore gets its events from the
   lifecycle steps themselves. `publish-notification-events.sh` remains as a
   manual fallback for testing the inbox without triggering the full flow:

   ```bash
   ./scripts/publish-notification-events.sh 42 7 "" 08 2026   # workerId jobId reviewId month year
   ```

## Running interactively in Postman

1. Import `postman/domestic-connects-worker-lifecycle.postman_collection.json`.
2. Make sure `baseUrl` (collection variable) points at the gateway
   (`http://localhost:8080`).
3. Run folder `0. Register Accounts`. Note the three emails printed in the
   test console (or copy them from the register responses).
4. Run the token extractor in manual mode (above) and paste the three
   `*VerifyToken=...` values into the collection variables.
5. Run folders `1. Verify, Login & Activate` through `5. Performance Review`.
6. Note the `workerId` printed by the register request, then run:
   `./scripts/publish-notification-events.sh <workerId>`.
7. Wait ~5 seconds, then run folders `6. Notifications` and
   `7. Admin Dashboard`.

> **Tips for Postman UI runs:** collection variables persist between runs —
> before re-running folder `0`, clear them (Collection → Variables → remove
> `workerEmail`/`workerId`/tokens, or simply re-import the collection) or you
> will get 409s on registration. Access tokens expire after **15 minutes**,
> so run the folders in one sitting; if requests start returning 401, re-run
> folder `1` to log in again and refresh the tokens.

## Configuration

| Variable         | Default                    | Meaning                                        |
|------------------|----------------------------|------------------------------------------------|
| `BASE_URL`       | `http://localhost:8080`    | Gateway base URL                               |
| `WORK_DIR`       | `/tmp/domestic-connects-it`| Scratch dir for exported Newman variables      |
| `DC_DB_HOST`     | `localhost`                | MySQL host (token script)                      |
| `DC_DB_PORT`     | `3307`                     | MySQL host port (3306 for non-Docker runs)     |
| `DC_DB_USER`     | `root`                     | MySQL user                                     |
| `DC_DB_PASS`     | `root@123`                 | MySQL password                                 |
| `DC_AUTH_DB`     | `auth_db`                  | Auth DB name (`domestic_connects_auth` locally)|
| `DC_KAFKA_CONTAINER` | `domestic-connects-kafka` | Kafka container (publish script)             |
| `DC_KAFKA_BROKER` | `kafka:9092`               | In-network broker (`localhost:29092` on host)  |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Login before verification rejected` fails | The `*VerifyToken` variables are empty — run `fetch-verification-tokens.sh` before folder 1. |
| `401 Unauthorized` everywhere | Access tokens are valid for 15 minutes; if a phase takes longer, re-run (fresh accounts) or shorten the gap. In the Postman UI, re-run folder `1` to log in again. |
| Notifications folder fails | The Kafka events weren't published, or the consumer hadn't caught up — re-run `publish-notification-events.sh <workerId>` and wait 5s, then re-run folder 6. |
| `kafka-console-producer` errors about the topic | Topics are created by the `kafka-init` one-shot; check `docker compose ps kafka-init` completed, or create them manually. |
| MySQL tokens not found | Wrong DB/port: for local `mvn spring-boot:run` use `DC_DB_PORT=3306 DC_AUTH_DB=domestic_connects_auth`. |
| 409 on register | Email collisions from an earlier partial run — harmless (folder 0 only checks its own run's emails), but `docker compose down -v` gives a clean slate. In the Postman UI, clear the persisted collection variables before re-running folder 0. |
| Services not discovered | Eureka registration takes ~30s after startup; wait for `docker compose ps` to show healthy. |

## Reset

```bash
docker compose down -v        # wipes MySQL, Redis and Kafka data
rm -rf /tmp/domestic-connects-it
```
