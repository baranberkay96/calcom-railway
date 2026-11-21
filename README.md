# Deploy and Host Cal.com with Railway

Cal.com is open-source scheduling software: share booking links, connect calendars and video apps, and let people pick a time that works. This template runs Cal.com 6.2 with PostgreSQL 18 and a small scheduler service for reminders and background tasks, and creates your admin account before the site goes online.

## About Hosting Cal.com

Cal.com is a large Next.js application backed by PostgreSQL. On start it rewrites its public URL into the built app, applies database migrations and seeds the app store. Booking e-mails, webhooks and reminders are queued in the database and processed when Cal.com's cron endpoints are called; on Vercel or GitHub Actions upstream does this with scheduled jobs.

This template adds a Scheduler service that calls those endpoints over Railway's private network, so the queue runs without outside services. A start script waits for Postgres, retries migrations and creates the first admin through Cal.com's own setup endpoint on a localhost-only server, so the setup page is never open to the public. Public sign-up is off by default.

## Common Use Cases

- Personal booking pages that replace Calendly
- Sales, support or interview scheduling with calendar sync
- Paid or approved bookings for consultants and small teams
- Embedding a booking widget in your own website

## Dependencies for Cal.com Hosting

- Cal.com v6.2.0 (`calcom/cal.com`, pinned by digest; the newest published self-host image)
- PostgreSQL 18 (Railway's `postgres-ssl` image)
- Scheduler: `curlimages/curl` with a small shell loop

### Deployment Dependencies

- Cal.com source (now Cal.diy): https://github.com/calcom/cal.diy
- Self-hosting docs: https://cal.com/docs/self-hosting/installation
- Resend (optional HTTP e-mail): https://resend.com/docs

### Implementation Details

| Service | What it does | Public |
|---|---|---|
| Calcom | Web app and API (Next.js, port 3000), migrations and first admin on start | yes |
| Scheduler | Calls the task queue every minute, webhook triggers every 5 min, booking reminders every 15 min, cleanups daily | no |
| Postgres | All Cal.com data | no |

**First login**

1. Wait for the first deploy to finish (migrations and the app-store seed take a few minutes).
2. Open the **Calcom** service's public URL and log in with `CAL_ADMIN_EMAIL` (default `admin@example.com`) and the generated `CAL_ADMIN_PASSWORD` from the Calcom service's Variables tab.
3. Finish onboarding, connect a calendar and create your first event type. Cal.com asks admins to enable two-factor authentication before the admin settings unlock.

**Users.** `NEXT_PUBLIC_DISABLE_SIGNUP=true` hides public sign-up; add people from Settings > Admin > Users. Set it to `false` to allow open registration.

**E-mail.** Without e-mail settings, bookings still work but no confirmations are sent. The easiest option on any Railway plan is Resend: set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on your verified domain). SMTP (`EMAIL_SERVER_*`) needs Railway Pro for outbound SMTP.

**Custom domain.** Add it to the Calcom service, set `NEXT_PUBLIC_WEBAPP_URL` and `NEXTAUTH_URL` to `https://{your-domain}` and redeploy. The start script rewrites the URL into the app.

**Lost admin password.** Set a new `CAL_ADMIN_PASSWORD` (15+ characters, upper- and lower-case letters and a digit) and `CAL_ADMIN_RESET_PASSWORD=true`, redeploy, then set it back to `false`.

**Versions.** The image is pinned in `services/calcom/Dockerfile` (`CALCOM_IMAGE`, tag and digest). Upstream has not published a newer image since v6.2.0; when a new release appears, update the tag and digest, back up Postgres and redeploy.

**Resources.** Measured on Railway on 2026-11-21: Cal.com used about 1.17 GB RAM during onboarding and booking, Postgres 0.09 GB and Scheduler under 0.001 GB. Budget roughly $13-18 per month for a lightly used project, including some CPU and database storage. **Hobby or higher is required; give Calcom at least 2 GB RAM.** The measured app exceeds the Trial 1 GB and Free 0.5 GB limits.

**License.** The v6.2.0 image is AGPL-3.0 with enterprise code that stays locked without a Cal.com license key; see NOTICE.md. This is a community template; it is not affiliated with Cal.com, Inc.

### Why Deploy Cal.com on Railway?

Railway runs Cal.com, its database and its scheduler as one project with private networking, managed volumes and HTTPS. You get a working booking platform with a secured admin account in minutes, and you can add a custom domain or change plans from the dashboard.
