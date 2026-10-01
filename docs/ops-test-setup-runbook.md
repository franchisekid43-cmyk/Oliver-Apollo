# Runbook: set up the operations test system (for Claude)

Oliver asked Claude (1 Oct 2026) to create the Supabase test project and set up the Vercel test link himself.
Claude does this with two temporary keys Oliver stores in the Claude Code environment settings — never in chat:
`SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access Tokens) and `VERCEL_TOKEN` (Vercel → Account Settings →
Tokens, expiry 1 day). Code: repo `philindo-command-center`, branch `ops-system`. Background:
`docs/ops-system-test-guide.md` (what the human steps were) and the Command Center's `CLAUDE.md`, section
"Operations system".

## Rules (do not bend)
- **Never change the live Supabase project** (the one the Production `DATABASE_URL` points at): no SQL, no settings,
  no password reset. Only create and use the new test project.
- **Never change a Production environment variable's value.** Only add Preview variables, or add the Preview target
  to an existing variable whose value is the same for both (Google key, SMTP).
- **Never print or save a secret** (tokens, the database password, connection strings, set-password links) in chat,
  files, commits or logs. Keep them in shell variables and send them straight to the API.
- Spending: if the new Supabase project would cost money (the organisation is not on the free plan, or already has
  2 free projects), **stop and ask Oliver** with the price before creating it.
- Nothing is written to the CA Tracker or Manifest Control sheets.

## Steps
1. **Check the keys:** `curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/organizations`
   and `curl -s -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/user` (and `/v2/teams`).
2. **Supabase:** list projects (`GET /v1/projects`); note the live project's ref and region — do not touch it.
   Check the organisation's plan (`GET /v1/organizations/{slug}`) and the cost rule above.
   Create `philindo-ops-test` in the same organisation and region (`POST /v1/projects` with a generated
   `db_pass`: `openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | head -c 32`). Wait until `ACTIVE_HEALTHY`.
   Session-pooler connection string: `GET /v1/projects/{ref}/config/database/pooler` (session mode, port 5432,
   user `postgres.{ref}`), password inserted from the shell variable.
3. **Vercel** (project `philindo-command-center`; pass `teamId` when it belongs to a team):
   - `GET /v9/projects/{id}/env`. If `DATABASE_URL` has the `preview` target, remove `preview` from it (keep
     `production`). Then add `DATABASE_URL` = the test connection string, target `preview`, `gitBranch: ops-system`.
   - Add (target `preview`, branch `ops-system`): `FIRST_ADMIN_EMAIL` and `TEST_MAIL_TO` = Oliver's work email
     (ask him if not given; the code's default is `transport@philindo.com.ph`), `FIRST_ADMIN_NAME` = `Oliver`.
   - `GOOGLE_SERVICE_ACCOUNT_JSON`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`: if they lack the `preview` target, add it
     (PATCH the target list only — the value is never read).
   - Deployment protection: turn Vercel Authentication off (`PATCH /v9/projects/{id}` with `ssoProtection: null`),
     because testers have no Vercel accounts and the app has its own sign-in. Tell Oliver this was done.
   - Redeploy the newest `ops-system` Preview deployment (`npx vercel redeploy <url> --token "$VERCEL_TOKEN"`, or
     `POST /v13/deployments` with `deploymentId`). The build runs `scripts/preview-setup.mts`, which prepares the
     empty test database and emails Oliver a 3-day "choose your password" link.
4. **Check:** the build log (`GET /v3/deployments/{id}/events`) shows `[test database] Ready.` and no
   errors; the branch URL's `/login` shows the sign-in page, not "Test database not connected"; open it with
   Playwright (Chromium at `/opt/pw-browsers`) and take a screenshot. Do not open the set-password link yourself.
5. **Tell Oliver** in plain words: the test link (the stable branch URL), that the password email is on its way (if
   SMTP is not set, say where in the build log the link is), what was changed in Vercel, and to delete both keys now
   (Supabase → Account → Access Tokens; Vercel → Account Settings → Tokens) and remove them from the environment
   settings.
