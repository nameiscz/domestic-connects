# payroll-service

Payroll microservice for DomesticConnect. Generates monthly **PDF salary slips**
(OpenPDF), exports payroll history as **CSV**, and bundles monthly slips into a
**ZIP**, by aggregating:

- present / half days → `attendance-service` (via OpenFeign)
- wage per day → `job-service` (via OpenFeign)

Gross salary is `(presentDays + halfDays / 2) × wagePerDay`. Every generated
slip is persisted as a `SalaryRecord` for history.

**Stack:** Spring Boot 3.2 · Java 21 · MySQL · Lombok · OpenFeign · OpenPDF 2.4 · Eureka client · config-client

---

## Endpoints

All endpoints are exposed through the **API gateway** on port `8080` (prefix
`/api`), which strips the prefix and forwards to this service (port `8084`).

| Endpoint (via gateway) | Description | Roles |
|---|---|---|
| `GET /api/payroll/{workerId}/slip?month=&year=&workerName=` | Salary slip as `application/pdf` | ADMIN, EMPLOYER, WORKER |
| `GET /api/payroll/{workerId}/history?month=&year=` | Persisted payroll history (JSON) | ADMIN, EMPLOYER, WORKER |
| `GET /api/payroll/{workerId}/history/export?month=&year=` | History as `text/csv` download | ADMIN, EMPLOYER, WORKER |
| `GET /api/payroll/batch/slips?month=&year=` | One slip per worker with attendance that month, as `application/zip` | ADMIN, EMPLOYER |

`month` is 1–12 and is required for the download endpoints. `workerName` is
optional (falls back to `Worker {workerId}` on the slip).

---

## Authentication model

The gateway's `JwtAuthGlobalFilter` **requires a valid JWT** (`Authorization:
Bearer <token>`) on every `/api/payroll/**` request, validates it, and forwards
the caller's role to this service as the `X-User-Role` header. Role checks below
are enforced against that header.

> **Why downloads can't be opened by just clicking a link:** a browser tab
> navigation cannot attach an `Authorization` header, so `curl`, Postman, or an
> authenticated `fetch` (see below) must be used. This is deliberate — the
> endpoints expose salary data keyed by `workerId` and must not be
> anonymously reachable. If you later want link-openable downloads, see the
> alternatives at the bottom.

---

## Downloading with an Authorization header

First obtain an access token from the auth-service:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"worker@example.com","password":"secret"}' \
  | jq -r '.accessToken')
```

### PDF salary slip

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/payroll/5/slip?month=6&year=2026&workerName=Ramesh" \
  -o salary-slip-5-6-2026.pdf
```

The suggested filename is always echoed in the `Content-Disposition` header.

### CSV history export

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/payroll/5/history/export?month=6&year=2026" \
  -o salary-history-5-6-2026.csv
```

### Batch ZIP of monthly slips

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/payroll/batch/slips?month=6&year=2026" \
  -o salary-slips-6-2026.zip
```

### From a browser SPA (React/Vue/etc.)

The standard pattern is an authenticated `fetch`, then trigger a download from
the returned blob (this works because `fetch` can send headers):

```js
async function downloadSlip(workerId, month, year) {
  const token = localStorage.getItem('accessToken'); // whatever your app stores
  const res = await fetch(
    `/api/payroll/${workerId}/slip?month=${month}&year=${year}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `salary-slip-${workerId}-${month}-${year}.pdf`; // or parse Content-Disposition
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

---

## Alternatives for link-openable downloads (not implemented)

If you need downloads to open directly in a browser tab (no headers), two
options exist — both trade some security:

1. **Whitelist the download paths in the gateway** (`JwtAuthGlobalFilter`)
   and drop the role check on those endpoints in `PayrollController`. Fastest,
   but anyone who can reach the gateway can download any worker's slip by
   guessing `workerId` — acceptable for local dev/demo only.
2. **Short-lived signed download tokens** — a JWT-protected token-minting
   endpoint in this service plus token validation in the gateway lets you append
   a 5-minute `?token=` to the URL. Browser-openable and still protected.

Neither is currently implemented; the download endpoints remain
Bearer-authenticated.
