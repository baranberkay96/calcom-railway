#!/bin/sh
# Calls Cal.com's cron endpoints on the schedule upstream uses on Vercel/GitHub Actions.
# Cal.com queues e-mails, webhooks and other background work in its database; the
# task endpoint processes that queue. Never prints the keys.
base="${CALCOM_INTERNAL_URL:-http://calcom.railway.internal:3000}"
base="${base%/}"

call() { # method path header-value label
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 600 -X "$1" \
    -H 'content-type: application/json' -H "authorization: $3" "$base$2" 2>/dev/null) || code="error"
  case "$code" in
    2*) [ "$4" = quiet ] || echo "[scheduler] $2 -> $code" ;;
    *) echo "[scheduler] WARNING: $2 -> $code" ;;
  esac
}

if [ -z "${CRON_SECRET:-}" ] || [ -z "${CRON_API_KEY:-}" ]; then
  echo "[scheduler] WARNING: CRON_SECRET or CRON_API_KEY is empty; reference them from the Cal.com service. Idling."
  while :; do sleep 3600; done
fi

echo "[scheduler] calling $base every minute (tasks), 5 min (webhook triggers), 15 min (booking reminders), 12 h / daily (cleanups)"
sleep "${SCHEDULER_START_DELAY:-120}"
minute=0
while :; do
  start=$(date +%s)
  call GET /api/tasks/cron "Bearer $CRON_SECRET" quiet
  [ $((minute % 5)) -eq 0 ] && call POST /api/cron/webhookTriggers "$CRON_API_KEY" quiet
  [ $((minute % 15)) -eq 0 ] && call POST /api/cron/bookingReminder "$CRON_API_KEY"
  [ $((minute % 720)) -eq 0 ] && call GET /api/cron/queuedFormResponseCleanup "Bearer $CRON_SECRET"
  [ $((minute % 1440)) -eq 0 ] && call GET /api/tasks/cleanup "Bearer $CRON_SECRET"
  minute=$(( (minute + 1) % 1440 ))
  elapsed=$(( $(date +%s) - start ))
  [ "$elapsed" -lt 60 ] && sleep $((60 - elapsed))
done
