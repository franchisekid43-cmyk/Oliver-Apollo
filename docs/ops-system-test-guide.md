# Philindo Operations — test version: set-up and what to try

*1 October 2026 · Parts 1–4 of the build brief, in the look of the new Philindo website, on the test system only.
The live Command Center, the CA Tracker and Manifest Control are not touched.*

## Status, 1 October (afternoon)

**Set up and working:** test link `philindo-command-center-git-ops-system-philindo.vercel.app` (every push to
`ops-system` updates it), its own Supabase test project `philindo-ops-test` (Singapore), Oliver signed in as Admin.
Loaded on the test link: the LogiSys Sea and Air registers (1,309 jobs) and the Organization list (729 address-book
entries).

**Latest changes (Oliver's asks of 1 October):**
- **Pending shipments match the live Command Center:** a LogiSys job still open more than 20 days after arrival, or
  with no ETA and opened before last month, is taken as delivered — the Command Center's own rule (Oliver asked for
  30 days; 20 is what the live Command Center uses, so the two agree). About 180 old jobs closed this way; about 73
  stay pending. Each closed one says why in its history. Runs after every LogiSys import and each morning.
- **Dashboard** (Admin and Management land on it after sign-in): the Command Center's look — 3D gradient cards for
  Pending shipments, Unbilled shipments and Unliquidated cash advances; the year's arrivals by month (sea FCL, LCL,
  air, against last year, target 2,500); the manifest board (next sea/air submission, latest manifested, waiting);
  and "Needs attention today". The old Overview is still at `/overview`.

**Matching the Command Center (1 October, afternoon):**
- **Unbilled** follows the CA Tracker: every current "For Billing" row in the Billing Tracker (shown as "Cannot bill
  yet" and "Awaiting approval") plus delivered JOs no billing tab knows ("not yet with the billing team"), counted from
  1 September. The CA Tracker is read again whenever the dashboard's copy is over 10 minutes old (Refresh button too).
  Fixed: jobs closed with no date were counted as delivered today, which inflated the unbilled list.
- **Pending shipments**: the new system now takes **Unilab's tracker** (page "Unilab tracker"), with the Command
  Center's rules. With today's LogiSys feed and Unilab's 29 Sep tracker, the Command Center's own code and the new
  dashboard both give 79. The live Command Center shows 98: the rest comes from older uploads and dates typed on its
  board — to be checked JO by JO from a PDF of its Pending page.
- The test link brings in LogiSys Live by itself (hourly check), since Vercel runs the 8:30 job on the live site only.

**Oliver's asks of 1 October (evening):**
- **Shipment Board** (was "Status board") with date filters: This week, Last week, This month, Last month, any month,
  or Custom dates (from–to), by arrival or by ETD. With dates chosen, open and closed jobs both show.
- **Download register** on the Shipment Board: tick the columns (remembered on your device), choose Excel or PDF —
  the file has exactly the jobs the board shows.
- **New JO numbers continue after the last shipment** (e.g. after IMP0926-1311 comes 1312). Two people saving at the
  same moment can never get the same number. While LogiSys is still used to open jobs, both could hand out the same
  number; the daily LogiSys update then skips the LogiSys one (a check on the LogiSys migration page lists it as
  "Made in the new system"). This ends when new jobs are opened only here.
- **Monthly report** (Admin, Management): the Command Center's arrivals report from this system's jobs — tables, five
  slides, Viber message and brief. Made by itself at 8:30 AM on the 7th for the month before; any month can be viewed
  live. The dashboard's arrivals chart uses the same counting (an FCL job with no containers = one 40ft).
- Menu: "Philindo Logistics", the green **New job** button on top, Address book and Clients at the bottom with Admin.
  Pages now fade when you click.

**Left for Oliver:** load Unilab's newest tracker on **Unilab tracker**; send a "Print / PDF" of the Command Center's
Pending page; on **Clients**, set the account handlers you listed (Ambica → Andrew, Fashion Rack → Jimmy,
Frabelle → Ramil — add him with "+ New account handler…", Indo-Mindanao → Cherry, Nabati Food → Cherry,
PT Industri → Jimmy, Triton → Jimmy, Unimex → Jimmy, Union Galva → Andrew, Universal Inkpro → Jena; Tri Globe and
SCG none). Their jobs without a handler get the same handler.

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

1. **Shipment Board:** date chips (this/last week, this/last month, a month, custom dates; by arrival or ETD), then
   **Download register** in Excel and PDF with your own columns. Mode chips and "Needs attention", filters (client, handler, stage), Open / Drafts / Closed / All,
   search (JO, FSA, PO, HBL, MBL, container), the flags. On a wide screen, click a row: the side panel shows its
   last and next steps with an **Update** button.
2. **New job** (green button at the top of the menu): pick the mode and watch the JO number preview change (IMP / AIMP /
   EXP / TRK; it follows the last shipment of the year). Save a draft with only mode, client and ETA. Fill in the rest, add containers and items, tick the documents.
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
10. **Dashboard:** compare the three cards with the live Command Center's Overview (pending should be close; billing
    and cash advances read the same CA Tracker). Point at a month on the arrivals chart; click a card to open its page.
11. **Monthly report:** open September, compare with the Command Center's September report (after its 7 October run),
    open the slides, copy the Viber message. From 7 October, 8:30 AM, September's report appears on its own.

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
- The Command Center pages (Cash advances, Billing, Manifest) keep their current look for now; they are in the same
  menu. Unilab tracker overrides the live Command Center applies to pending shipments are not in the new system yet.
