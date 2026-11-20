# Notice

This package deploys **Cal.com** by Cal.com, Inc. using the official Docker image `calcom/cal.com:v6.2.0` (digest pinned, unmodified as the base).

## Licensing (checked 2026-11-20)

- The GitHub repository `calcom/cal.com` now redirects to `calcom/cal.diy`, the MIT-licensed community edition. Its relicensing commit (2026-04-15) came after the last tagged release; no Cal.diy release tag or Docker image has been published yet.
- The newest published self-host image is therefore `calcom/cal.com:v6.2.0` (2026-03-02), built from tag `v6.2.0`, whose LICENSE reads: content under `packages/features/ee` and `apps/api/v2/src/ee` is under the Cal.com commercial license (`ee/LICENSE`); everything else is **AGPL-3.0**. Source for that image: https://github.com/calcom/cal.diy/tree/v6.2.0
- The template uses the AGPL core. Enterprise features (Teams, Organizations, Insights, Workflows, SSO and others) stay locked without a Cal.com license key; the template does not set one. If you modify Cal.com and offer it to users over a network, the AGPL requires you to offer them your modified source.
- Upstream recommends Cal.diy for personal self-hosting and Cal.com (hosted or licensed) for commercial or enterprise use. Review the license that fits your use.

## What is used and how

- `services/calcom/railway-calcom.sh` repeats the steps of upstream `scripts/start.sh` (tag `v6.2.0`) and calls upstream `scripts/replace-placeholder.sh`; additions are original.
- `services/calcom/railway-calcom.js` is original. It creates the first admin through Cal.com's own `/api/auth/setup` endpoint and uses the image's `pg` and `bcryptjs` packages.
- `services/scheduler` is original; the endpoints and intervals follow upstream `apps/web/vercel.json` and `.github/workflows/cron-*.yml` at tag `v6.2.0`.
- Configuration follows upstream `.env.example`, `Dockerfile` and `docker-compose.yml` at tag `v6.2.0`.
- Base images: `curlimages/curl:8.23.0` (curl license), Railway's `postgres-ssl` Postgres template.
- Icon: Dashboard Icons by homarr-labs (https://github.com/homarr-labs/dashboard-icons).

Market templates were read for comparison only; no files or text were copied. README and docs text are original.

This is a community template and is not affiliated with or endorsed by Cal.com, Inc. "Cal.com" is a trademark of Cal.com, Inc.
