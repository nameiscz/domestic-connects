# performance-service

Performance review microservice for DomesticConnect. Employers and admins rate
workers on a scale of **1–5** with optional remarks; workers can later view
their review history and **average rating**.

**Stack:** Spring Boot 3.2 · Java 21 · MySQL · Lombok · Eureka client · config-client

---

## Endpoints

All endpoints are exposed through the **API gateway** on port `8080` (prefix
`/api`), which strips the prefix and forwards to this service (port `8085`).

| Endpoint (via gateway) | Description | Roles |
|---|---|---|
| `POST /api/performance/review` | Submit a performance review | ADMIN, EMPLOYER |
| `PUT /api/performance/review/{id}` | Update rating/remarks of an existing review (404 if missing) | ADMIN, EMPLOYER |
| `DELETE /api/performance/review/{id}` | Permanently delete a review (404 if missing) | ADMIN |
| `GET /api/performance/worker/{workerId}` | Review history + average rating | ADMIN, EMPLOYER, WORKER (own only) |
| `GET /api/performance/worker/{workerId}/history` | Paginated review history (`page` 0-based, `size` 1–100, default `?page=0&size=10`) | ADMIN, EMPLOYER, WORKER (own only) |

### `POST /api/performance/review` — request body

```json
{
  "workerId": 5,
  "jobId": 3,
  "rating": 4,
  "remarks": "Punctual and careful with the children.",
  "reviewedBy": "employer@example.com"
}
```

`rating` must be an integer between 1 and 5 (inclusive). `remarks` is optional
(max 1000 chars). Returns the created review with HTTP `201`. The 1–5 range is
also enforced by a database check constraint as a final line of defence — note
it is emitted only when Hibernate creates the `performance_review` table, so
fresh databases only.

### `PUT /api/performance/review/{id}` — request body

```json
{
  "rating": 5,
  "remarks": "Revised after follow-up."
}
```

Updates the mutable fields (`rating`, `remarks`) of an existing review.
`workerId`, `jobId` and `reviewedBy` are immutable identity/audit fields and
are never changed. This is strict **PUT** semantics: `remarks` is replaced
wholesale, so an omitted `remarks` clears the existing one. Returns the updated
review with HTTP `200`, or `404` when the review does not exist. Reviews use
**optimistic locking** (`@Version`): concurrent edits fail with HTTP `409`
Conflict and the caller should reload and retry. The `updatedAt` field records
the last modification time; `createdAt` is immutable.

### `DELETE /api/performance/review/{id}`

Permanently deletes a review (**ADMIN only**). Reviews are immutable history
records with no status field, so a hard delete is used rather than a soft one.
Returns `{"success": true, ...}` with HTTP `200`, or `404` when the review
does not exist.

### `GET /api/performance/worker/{workerId}` — response

```json
{
  "workerId": 5,
  "reviewCount": 2,
  "averageRating": 4.5,
  "reviews": [
    { "id": 2, "workerId": 5, "jobId": 3, "rating": 5, "remarks": "...", "reviewedBy": "...", "createdAt": "2026-08-03T10:00:00" },
    { "id": 1, "workerId": 5, "jobId": 3, "rating": 4, "remarks": "...", "reviewedBy": "...", "createdAt": "2026-08-01T09:00:00" }
  ]
}
```

`averageRating` is rounded to two decimal places and is `null` until the worker
has at least one review. `ratingDistribution` lists the review count per rating
as a 5-element array covering ratings 1–5 in ascending order (zero counts
included), e.g. `[{"rating":1,"count":0},...,{"rating":5,"count":2}]`.

### `GET /api/performance/worker/{workerId}/history?page=0&size=10`

Returns the same `WorkerPerformanceReport` shape as the summary endpoint, but
with the `reviews` list sliced to the requested page (0-based `page`, `size`
1–100, default `page=0&size=10`). Pagination metadata is included: `page`,
`size` (reviews in this page), `totalPages`, and `totalElements` (total reviews
for the worker). `reviewCount` and `averageRating` always reflect the worker's
<b>entire</b> history, not just the current page.

**Ownership rule:** `WORKER` callers may only read their **own** reviews. The
controller matches the gateway-forwarded `X-User-Id` header (the validated JWT's
numeric `userId` claim) against the path `workerId` and returns `403` on
mismatch or when the header is missing. `ADMIN` and `EMPLOYER` may read any
worker's reviews.

---

## Authentication model

The gateway's `JwtAuthGlobalFilter` requires a valid JWT on every
`/api/performance/**` request and forwards the caller's role as the
`X-User-Role` header. Role checks are enforced against that header in
`PerformanceReviewController` — no Spring Security filter chain runs inside
this service.

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"employer@example.com","password":"secret"}' \
  | jq -r '.accessToken')

curl -X POST http://localhost:8080/api/performance/review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workerId":5,"jobId":3,"rating":4,"remarks":"Punctual.","reviewedBy":"employer@example.com"}'

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/performance/worker/5
```
