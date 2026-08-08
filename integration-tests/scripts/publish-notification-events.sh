#!/usr/bin/env bash
#
# publish-notification-events.sh
# -----------------------------------------------------------------------------
# Publishes the three notification events to Kafka, simulating the producers
# that job-service, payroll-service and performance-service are expected to
# ship. notification-service consumes these topics and persists a Notification
# for the worker, which the "6. Notifications" collection folder then verifies.
#
# Topics (created by docker-compose kafka-init):
#   job-assigned           -> NotificationType.JOB_ASSIGNED
#   salary-slip-generated  -> NotificationType.SALARY_SLIP_GENERATED
#   performance-reviewed   -> NotificationType.PERFORMANCE_REVIEWED
#
# Usage:
#   publish-notification-events.sh <workerId> [jobId] [reviewId] [month] [year]
#
# Requires the running Kafka container from docker-compose:
#   DC_KAFKA_CONTAINER  (default domestic-connects-kafka)
#   DC_KAFKA_BROKER     (default kafka:9092 - in-network address; host tools
#                        would use localhost:29092)
# -----------------------------------------------------------------------------
set -euo pipefail

WORKER_ID="${1:?usage: publish-notification-events.sh <workerId> [jobId] [reviewId] [month] [year]}"
JOB_ID="${2:-}"
REVIEW_ID="${3:-}"
MONTH="${4:-$(date +%m)}"
YEAR="${5:-$(date +%Y)}"

CONTAINER="${DC_KAFKA_CONTAINER:-domestic-connects-kafka}"
BROKER="${DC_KAFKA_BROKER:-kafka:9092}"
TS="$(date -u +%Y-%m-%dT%H:%M:%S)"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: Kafka container '$CONTAINER' is not running." >&2
  echo "       Start the stack first:  docker compose up --build -d" >&2
  exit 3
fi

# JSON null for empty optional ids, otherwise the raw number.
ref() { [[ -n "${1:-}" ]] && printf '%s' "$1" || printf 'null'; }

publish() {
  local topic="$1"
  local payload="$2"
  echo "==> publishing to '$topic' (userId=$WORKER_ID)"
  echo "$payload" | docker exec -i "$CONTAINER" kafka-console-producer \
    --bootstrap-server "$BROKER" --topic "$topic" >/dev/null
}

publish job-assigned "{\"userId\":$WORKER_ID,\"type\":\"JOB_ASSIGNED\",\"message\":\"You have been assigned to a new job.\",\"referenceId\":$(ref "$JOB_ID"),\"timestamp\":\"$TS\"}"
publish salary-slip-generated "{\"userId\":$WORKER_ID,\"type\":\"SALARY_SLIP_GENERATED\",\"message\":\"Your salary slip has been generated for $MONTH/$YEAR.\",\"referenceId\":null,\"timestamp\":\"$TS\"}"
publish performance-reviewed "{\"userId\":$WORKER_ID,\"type\":\"PERFORMANCE_REVIEWED\",\"message\":\"A new performance review has been submitted for you.\",\"referenceId\":$(ref "$REVIEW_ID"),\"timestamp\":\"$TS\"}"

echo "==> Done. Wait a few seconds for the notification consumer to persist the rows."
