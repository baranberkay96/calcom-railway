# Cal.com v6.2.0 (the latest published self-host image; AGPL-3.0 core) with a Railway
# start script: URL and key checks, migrations with retries, and the first admin created
# on a localhost-only server before the public port opens.
ARG CALCOM_IMAGE=calcom/cal.com:v6.2.0@sha256:ace3bb1219fb7306585ab9f4d94d41af7ee064c343db0498173436bbe857bd49
FROM ${CALCOM_IMAGE}

COPY --chmod=0755 railway-calcom.sh /railway/railway-calcom.sh
COPY --chmod=0755 railway-calcom.js /railway/railway-calcom.js

CMD ["/railway/railway-calcom.sh"]
