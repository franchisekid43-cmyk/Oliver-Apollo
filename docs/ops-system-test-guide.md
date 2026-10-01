# Philindo Operations — test version: set-up and what to try

*1 October 2026 · Parts 1–4 of the build brief, in the look of the new Philindo website, on the test system only.
The live Command Center, the CA Tracker and Manifest Control are not touched.*

## Status, 1 October (morning)

**Done by Claude:**
- **Test database:** Supabase project `philindo-ops-test` (free plan, Singapore), in the organisation
  "philindo-command-center". It is empty until the first test build sets it up.
- **Vercel test settings (Preview only):** `DATABASE_URL` → the test database, `FIRST_ADMIN_EMAIL` and
  `TEST_MAIL_TO` → transport@philindo.com.ph, `FIRST_ADMIN_NAME` → Oliver. No Production setting was changed.

**Left for you** (Claude's safety rules don't let it change these) — Vercel → project **philindo-command-center** → **Settings**:
1. **Deployment Protection** → turn **Vercel Authentication** off → Save. Without this, testers are asked for a
   Vercel login.
2. **Git** → **Connect Git Repository** → GitHub → `philindo-command-center`. Until now the site was only deployed
   by hand, so pushes made no test links.
3. **Build and Deployment** → **Root Directory** → `web` → Save (the app lives in that folder).
4. **Deployments** → **Create Deployment** → branch `ops-system` → Create. Its link will be
   `philindo-command-center-git-ops-system-philindo.vercel.app`. From then on every push to `ops-system` updates it,
   and a push to `main` updates the live site (as it should).
5. *Optional:* **Environment Variables** → `GOOGLE_SERVICE_ACCOUNT_JSON`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` →
   Edit → also tick **Preview** → Save. Without them the test site shows sign-in codes on screen instead of
   emailing them, and LogiSys data is loaded by uploading the export files instead of from LogiSys Live.
   If Vercel asks you to type the value again, skip this step.
6. **Your first sign-in:** the new deployment → **Build Logs** → search `Set-password link` → open that link
   (works once, for 3 days), choose your password, then sign in with transport@philindo.com.ph.
7. **Delete the two keys** you made for Claude: Supabase → Account → Access Tokens; Vercel → Account Settings →
   Tokens.

## 1. Where it is

- Code: repo `philindo-command-center`, branch **`ops-system`** (not `main`, so nothing reaches the live site).
- Vercel builds a **test link** (a "Preview") from that branch automatically. It looks like
  `https://philindo-command-center-git-ops-system-….vercel.app`. Find it in Vercel → your project → **Deployments**
  (the newest one marked *Preview*, branch `ops-system`).
- The test link works only once it has its own test database (steps below). Until then it shows a page saying
  "Test database not connected", and it reads and changes nothing. The same page appears if the test link is ever
  pointed at the live database by mistake.

## 2. One-time set-up (about 20 minutes)

Keep passwords and keys out of chats. They go only into Supabase and Vercel.

### A. Supabase — a new, empty test project
1. supabase.com → your organisation → **New project**. Name: `philindo-ops-test`. Region: the same as the live project.
   Choose a strong database password and keep it in your password manager.
2. When it's ready: **Connect** (top of the project page) → **Session pooler** → copy the connection string and put your
   database password where it says `[YOUR-PASSWORD]`.

### B. Vercel — settings for the test link only
Project → **Settings → Environment Variables**.

1. **First check `DATABASE_URL`.** It must be ticked for **Production** only. If *Preview* is ticked too, edit it and untick
   Preview. (Even if you forget, the test link refuses to use a database that isn't the test one, but please check.)
2. **Add** these, each ticked for **Preview only**:

| Name | Value |
|---|---|
| `DATABASE_URL` | the test connection string from A.2 |
| `FIRST_ADMIN_EMAIL` | your work email, e.g. `transport@philindo.com.ph` — you become the first Admin |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the same value as Production (the read-only Google key — needed to load LogiSys Live) |
| `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | the same values as Production (sends sign-in codes and invitations) |
| `TEST_MAIL_TO` | where the test system's other emails go, e.g. `transport@philindo.com.ph` |

   If Google or SMTP values are already ticked for "All environments", you can leave them as they are.
3. **Settings → Deployment Protection:** switch **Vercel Authentication** off for Preview deployments (the app has its own
   sign-in), or your team will be asked for a Vercel account they don't have.
4. **Deployments** → the newest `ops-system` Preview → **⋯ → Redeploy**. The build prepares the test database by itself.

### C. Your first sign-in
- The build emails you a "choose your password" link (if SMTP is set). If it doesn't arrive: Vercel → the deployment →
  **Build Logs** → search for `Set-password link` and open that link. It works once, for 3 days.
- Sign in with your work email and new password. On a new device you get a 6-digit code by email.
  (If email isn't set up on the test system, the code is shown on the screen instead — test system only.)

## 3. Load the 2026 jobs

**LogiSys migration** (Admin menu) → **Check LogiSys Live** (or upload LogiSys Excel/CSV exports — up to 5 files,
4 MB in total). It goes in four steps, like your design: *Upload → Match fields → Check → Import*.
- **Match fields** shows each LogiSys column and where it goes. Columns marked "Not used" are not brought across —
  tell me if one matters.
- **Check**: nothing is saved yet. You see what will be added, updated or skipped, and every problem found:
  duplicate JOs, no client, unreadable dates, ATA equal to ETA, FSA numbers turned into dates, statuses with no
  matching milestone, new client names, jobs never closed in LogiSys.
- **Import**. Jobs never closed in LogiSys (arrived more than 20 days ago) are closed on import unless you untick that box.

After that first import, the 8:30 run keeps LogiSys jobs up to date every morning until the switch (not before —
nothing comes in by itself until you have checked and imported once). It never overwrites anything a person typed
or changed: a field, a container, a party, or a job someone closed or reopened. A job closed here is never changed
by LogiSys; if LogiSys still shows it moving, the check lists it so someone can reopen it.

On the test link the 8:30 schedule doesn't run (Vercel only runs schedules on the live site): use **Pull today's
LogiSys feed now** on the same page to bring in today's statuses.

The same page shows the **JO numbering**: the last number used this year and what the next JO will be. At the switch
in December you set it to LogiSys's last number, so new JOs carry straight on.

## 4. Invite the testers

**Users** (Admin menu) → **Invite**: name, work email, role, and for account handlers their handler name. They get an
email with a link to choose a password; you can also copy the link and send it by Viber.

| Role | For |
|---|---|
| Admin | you (and the second Admin) |
| Management | Pablo |
| Operations | Kim, Andrew, Cherry, Jena, Jimmy, Jasmin — each linked to their handler name |
| Documentation | Ariel |
| Manifest | Danica |
| Billing & CA | Jonathan |
| Transport | the transport team |

## 5. What to try

1. **Status board:** mode chips and "Needs attention", filters (client, handler, stage), Open / Drafts / Closed / All,
   search (JO, FSA, PO, HBL, MBL, container), the flags. On a wide screen, click a row: the side panel shows its
   last and next steps with an **Update** button.
2. **New job:** pick the mode and watch the JO number preview change (IMP / AIMP / EXP / TRK; test numbers start at
   9001). Save a draft with only mode, client and ETA. Fill in the rest, add containers and items, tick the documents.
   Try a duplicate HBL to see the warning.
3. **Milestones:** on a job, "Done today" or type a date — the stage changes by itself. Try the **Update** button on
   the board. Sign in as a Transport user: only the delivery steps can be changed.
4. **Access:** account handlers see every job, but can change only their own clients' jobs — open another handler's
   job and it is read-only. As Management (Pablo), everything is visible and nothing can be changed.
5. **History:** every change shows at the bottom of the job, with who and when. It can't be edited.
6. **Client reports:** Clients page → turn the daily report on for a client and add their emails → Client reports →
   **Copy for Viber** or **Email report** (on the test system the email goes to `TEST_MAIL_TO`, never to the client).
7. **Admin:** Users & roles (invite, change a role, send a password link, deactivate someone and see them signed out,
   the sign-in activity), Milestone lists (rename, reorder, hide steps; assign steps to Manifest / Billing /
   Transport; the document checklist), Change log (filter by JO, person, date).
8. **My account** (your name, bottom left): change your password, see your remembered devices, sign out everywhere.
9. **Phone:** open the test link on a phone — the menu is behind the ☰ button.

## 6. Known gaps in this version

- **File upload:** the file checklist is there; uploading the files themselves needs a storage decision (Supabase Storage).
- **Air import, export and trucking milestone lists are provisional** until you send the real ones. Sea import follows
  your 27 LogiSys steps (the names marked "?" still to confirm; hidden step 7 is switched off).
- **Manifest steps:** no step is assigned to the Manifest team yet — tell me which ones (or set them on Milestone lists).
- **Full LogiSys export with milestone history:** the upload reads LogiSys Live and the Sea/Air register exports now
  (the current status becomes the job's milestone). Send me the full export and I'll add its columns and the whole
  milestone history.
- **Penny** stays on the LogiSys Live sheet until cutover. Her feed from the new system is ready at `/api/ops/penny-feed`
  (needs a `PENNY_FEED_TOKEN`), to be switched on in December.
- The Command Center pages (Overview, Cash advances, Billing, Manifest) keep their current look for now; they are
  in the same menu.
