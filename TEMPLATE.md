# Cal.com 6.2 Scheduling Platform (Postgres, Scheduler): composer spec

Listing name: **Cal.com 6.2 Scheduling Platform (Postgres, Scheduler)**
Description (75 chars): Open-source Calendly alternative with booking reminders and an admin login.
Category: Other. Icon: `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/cal-com.svg`
Repository: `baranberkay96/calcom-railway` (this folder is the repo root).

## Image and licence decision

`calcom/cal.com` now redirects to `calcom/cal.diy` (MIT since 2026-04-15), but Cal.diy has no release tag or image yet; the release workflow still publishes `calcom/cal.com` and the newest tag is `v6.2.0` (2026-03-02, AGPL-3.0 core + commercial `ee/`). Building Cal.diy from source on every user deploy is not viable (Next.js monorepo build, `MAX_OLD_SPACE_SIZE=6144`, long and memory-hungry builds that would fail on small plans). So the template uses the prebuilt v6.2.0 image. It needs no build-time URL: upstream `scripts/start.sh` replaces the built `NEXT_PUBLIC_WEBAPP_URL` placeholder at start, which our start script repeats. Switch to a Cal.diy image once one is published.

## Services

| Service | Source | Public | Volume | Healthcheck |
|---|---|---|---|---|
| Calcom | repo `/services/calcom` (`FROM calcom/cal.com:v6.2.0@sha256:ace3bb12…bd49`) | domain → 3000 | none | `/auth/login`, 1200 s |
| Scheduler | repo `/services/scheduler` (`FROM curlimages/curl:8.23.0@sha256:3fb7e13e…fd93`) | no | none | — |
| Postgres | `ghcr.io/railwayapp-templates/postgres-ssl:18.6@sha256:4fc833b4…c863` | no | `/var/lib/postgresql/data` | — |

Service name `Calcom` (no dot) so `${{Calcom.X}}` references parse.

## Start sequence (`railway-calcom.sh`)

1. `NEXT_PUBLIC_WEBAPP_URL` not http(s) → Railway domain; `NEXTAUTH_URL` follows it if invalid. `CALENDSO_ENCRYPTION_KEY` not 32 chars → first 32 hex chars of its SHA-256. `NEXTAUTH_SECRET` shorter than 16 → SHA-256 hex.
2. Upstream `replace-placeholder.sh` (built URL → runtime URL).
3. Postgres wait (pg, 15 min), `prisma migrate deploy` with 6 retries, upstream `seed-app-store.ts` (non-fatal).
4. `railway-calcom.js admin`: if `users` is empty, start `next start` on 127.0.0.1:3999, `POST /api/auth/setup` (Cal.com's own first-admin endpoint, role ADMIN), kill it. Invalid e-mail → `admin@example.com`; password failing Cal.com's admin rule (15+, upper, lower, digit) → random strong password nobody knows + log hint. `CAL_ADMIN_RESET_PASSWORD=true` sets a bcrypt(12) hash in `UserPassword`.
5. `exec yarn start` (upstream).

The default password is `Cal` + `secret(20)` + `9x`, so it always satisfies the admin rule.

## Scheduler

Cal.com queues e-mails, webhooks and other work in its database (`InternalTasker`); upstream runs the processors from Vercel crons and GitHub Actions. The Scheduler loop calls, over the private network: `/api/tasks/cron` every minute (Bearer `CRON_SECRET`), `/api/cron/webhookTriggers` every 5 min and `/api/cron/bookingReminder` every 15 min (`CRON_API_KEY`), `/api/cron/queuedFormResponseCleanup` every 12 h, `/api/tasks/cleanup` daily. Enterprise workflow reminders are not called (EE feature).

## Improvements over market templates

Market (2026-11): leader "Cal.com" 224 active on `calcom/cal.com:latest`, Postgres 17, healthcheck `/`, a stray quote in `CALENDSO_ENCRYPTION_KEY`, `ORGANIZATIONS_ENABLED=true` (EE), telemetry on, and the `/auth/setup` page open to whoever arrives first. Others: `v6.2.0` without telemetry/setup handling; `:latest` copies.

- Pinned v6.2.0 by digest; Postgres 18; valid 32-character encryption key from `secret()`.
- First admin created on a localhost-only server before the public port opens; sign-up off by default.
- Scheduler service so queued e-mails, webhooks and booking reminders actually run.
- Resend (HTTP) e-mail option documented for plans without SMTP.
- Migration retries, Postgres wait; odd values never stop the start (STANDARD 8.29).

## Resources

Measured on Railway on 2026-11-21: Calcom 1.17 GB during onboarding and guest booking, Postgres 0.09 GB, Scheduler 0.0007 GB. RAM alone is about $12.60/month; budget $13-18/month with light CPU use and the database volume. Minimum plan: Hobby; allocate at least 2 GB RAM to Calcom. The measured app exceeds Trial 1 GB and Free 0.5 GB limits. CPU depends on booking traffic; the scheduler is idle between HTTPS calls.

## Verification checklist

1. All services SUCCESS; `/auth/login` 200; log shows migrations, seed and `first admin … created`.
2. `/auth/setup` no longer creates users (`POST /api/auth/setup` → 400 "No setup needed").
3. Credentials login through NextAuth with the generated password → session; wrong password → rejected.
4. Create an event type and book it as a guest through the public booking page API; booking stored.
5. Scheduler log shows 2xx for `/api/tasks/cron` and booking reminders.
6. Fresh deploy with odd values → SUCCESS with warnings.

## Open questions

- When Cal.diy publishes images, move to them (MIT, no EE code).
- Calendar OAuth, paid integrations, outbound e-mail delivery and enterprise features require external credentials and were not tested. Core admin onboarding, event creation, guest booking, duplicate rejection and every Scheduler endpoint were tested on Railway on 2026-11-21; anonymous signup redirects to the disabled-signup error.
