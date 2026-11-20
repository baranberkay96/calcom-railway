# Cal.com scheduler: calls Cal.com's cron endpoints over the private network
# (task queue every minute, booking reminders, scheduled webhooks, cleanups).
FROM curlimages/curl:8.23.0@sha256:3fb7e13e5d179a845c97d78204f3f1064d1907037f26a3ebf91710571151fd93

COPY --chmod=0755 railway-scheduler.sh /usr/local/bin/railway-scheduler.sh

ENTRYPOINT ["/usr/local/bin/railway-scheduler.sh"]
