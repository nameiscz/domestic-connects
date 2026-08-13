#!/usr/bin/env bash
#
# run-newman.sh - one-command runner for the Domestic Connects worker-lifecycle
# integration suite against a running stack (docker compose up --build -d).
#
# The suite covers: register -> login -> activate, job posting & assignment,
# attendance, salary slip generation/download, performance review, notifications
# and admin dashboard analytics.
#
# Phases:
#   1. Run collection folder "0. Register Accounts" and export the run variables
#      (unique emails, user ids, passwords) to $WORK_DIR/vars.json.
#   2. Run folders 1-5 (login/activate, jobs, attendance, payroll, performance).
#   3. Publish the notification events to Kafka (scripts/publish-notification-events.sh),
#      wait for the consumer, then run folders 6-7 (notifications, admin dashboard).
#
# Env overrides:
#   BASE_URL  (default http://localhost:8080)
#   WORK_DIR  (default /tmp/domestic-connects-it)
#   plus the DC_KAFKA_* vars documented in publish-notification-events.sh.
#
# Requirements: newman (npm install -g newman), node, docker (for Kafka).
# -----------------------------------------------------------------------------
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECTION="$SCRIPT_DIR/../postman/domestic-connects-worker-lifecycle.postman_collection.json"
WORK_DIR="${WORK_DIR:-/tmp/domestic-connects-it}"
VARS="$WORK_DIR/vars.json"
ENV_NORM="$WORK_DIR/env-normalized.json"

if ! command -v newman >/dev/null 2>&1; then
  echo "ERROR: newman is not installed. Install it with:  npm install -g newman" >&2
  exit 2
fi

mkdir -p "$WORK_DIR"

# -----------------------------------------------------------------------------
# Reads a variable from a Newman exported environment file (works whether it is
# a {key,value,enabled}[] environment file or a flat {key:value} object).
# -----------------------------------------------------------------------------
get_var() {
  node -e '
    const fs = require("fs");
    const raw = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const vals = Array.isArray(raw.values)
      ? raw.values
      : Object.entries(raw).map(([k, v]) => ({ key: k, value: v }));
    const e = vals.find((v) => v.key === process.argv[2]);
    process.stdout.write(e ? String(e.value) : "");
  ' "$VARS" "$1"
}

# -----------------------------------------------------------------------------
# Normalises the exported variables into a Newman-compatible environment file.
# -----------------------------------------------------------------------------
normalise_env() {
  node -e '
    const fs = require("fs");
    const raw = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const vals = Array.isArray(raw.values)
      ? raw.values.map((v) => ({ key: v.key, value: v.value, enabled: v.enabled !== false }))
      : Object.entries(raw).map(([k, v]) => ({ key: k, value: String(v), enabled: true }));
    fs.writeFileSync(process.argv[2], JSON.stringify({
      id: "dc-vars", name: "dc-vars", values: vals
    }, null, 2));
  ' "$1" "$2"
}

echo "===================================================================="
echo "[1/3] Registering worker, employer and admin accounts (folder 0)"
echo "===================================================================="
newman run "$COLLECTION" \
  --folder "0. Register Accounts" \
  --env-var baseUrl="$BASE_URL" \
  --export-environment "$VARS" \
  --reporters cli

# Hand the phase-1 variables (emails, ids, passwords) to the next newman run.
normalise_env "$VARS" "$ENV_NORM"

echo
echo "===================================================================="
echo "[2/3] Login/activate, jobs, attendance, payroll, performance"
echo "===================================================================="
newman run "$COLLECTION" \
  --folder "1. Login & Activate" \
  --folder "2. Job Posting & Assignment" \
  --folder "3. Attendance" \
  --folder "4. Salary Slip & Payroll" \
  --folder "5. Performance Review" \
  --environment "$ENV_NORM" \
  --env-var baseUrl="$BASE_URL" \
  --export-environment "$VARS" \
  --reporters cli

WORKER_ID="$(get_var workerId)"
MONTH="$(get_var month)"
YEAR="$(get_var year)"
JOB_ID="$(get_var jobId)"
if [[ -z "$WORKER_ID" || -z "$MONTH" || -z "$YEAR" ]]; then
  echo "ERROR: could not read workerId/month/year from the exported variables." >&2
  echo "       Check $VARS and the newman output above." >&2
  exit 3
fi

echo
echo "===================================================================="
echo "[3/3] Publishing notification events for worker $WORKER_ID"
echo "===================================================================="
"$SCRIPT_DIR/publish-notification-events.sh" "$WORKER_ID" "$JOB_ID" "" "$MONTH" "$YEAR"
echo "Waiting 6s for the Kafka consumer to persist the notifications..."
sleep 6

# Refresh the environment file with the tokens/ids written by folders 1-5.
normalise_env "$VARS" "$ENV_NORM"

# The admin dashboard summary is Redis-cached for 5 minutes. Flush it so
# folder 7 aggregates the data THIS run just created instead of a stale
# summary from an earlier run or smoke test.
docker exec domestic-connects-redis redis-cli FLUSHDB >/dev/null 2>&1 || \
  echo "WARNING: could not flush Redis — folder 7 may read a stale cached summary." >&2

newman run "$COLLECTION" \
  --folder "6. Notifications" \
  --folder "7. Admin Dashboard" \
  --environment "$ENV_NORM" \
  --env-var baseUrl="$BASE_URL" \
  --reporters cli

echo
echo "================================================================"
echo "SUCCESS: full worker lifecycle covered end-to-end."
echo "================================================================"
