# Philindo Operations System — review and proposal

*30 September 2026 · Step 1 of the build brief · Nothing has been built or changed yet — this waits for your OK.*

## In one minute

- **All tests pass.** Penny 114/114, importer 64/64, and the Command Center's own 97/97 (it also builds cleanly).
- **The Command Center is not in this repo.** It lives in a separate private repo, `philindo-command-center` (folder `web/`). The build has to happen there.
- **It is a sound base.** It is tidy, tested, and careful about keeping the Google Sheets read-only. Three parts of the plan are new work rather than tweaks: sign-in, access enforced by the database, and a proper job record. Today's `shipments` table holds only about 20 fields for the Pending board.
- **Two things to check before I push anything** (section 4, items 1–2): that Vercel's test links don't use the live database, and whether the live database can be read through Supabase's public web address.
- **Decisions I need** are in section 11. The main one: your milestone list and Penny put some steps in different stages.

---

## 1. Test results

| Suite | Result |
|---|---|
| Penny (`node penny/penny_tests.js`) | **114 passed, 0 failed** |
| LogiSys importer (`node importer/importer_tests.js`) | **64 passed, 0 failed** |
| Command Center (`npm test` in `web/`) | **97 passed, 0 failed**; code check and lint clean; production build succeeds |

A note on the Command Center: on a brand-new copy its code checker complains until Next.js generates its page types (`npx next typegen`). That is not a bug, and a normal build does it automatically.

---

## 2. How things are built today

### Where the code is

| What | Where | Runs on |
|---|---|---|
| Command Center web app | repo `philindo-command-center`, folder `web/` | Vercel; database on Supabase |
| LogiSys importer | repo `Oliver-Apollo`, folder `importer/` | Google Apps Script |
| Penny | repo `Oliver-Apollo`, folder `penny/` | Google Apps Script |

The web app is built with Next.js, which keeps the pages and the server code in one project. Its database is Postgres on Supabase. The app connects to the database directly with its own connection string. It does **not** use Supabase's sign-in or Supabase's web API.

### What runs when (Manila time)

| Time | What |
|---|---|
| 06:00 | LogiSys emails the Sea and Air registers. The importer checks every 15 minutes and writes them into `LogiSys Live` and `LogiSys Archive`. |
| 07:45 | Penny reads LogiSys Live and the CA Tracker, then emails the COO. |
| 08:30 | Command Center morning job: adds today's LogiSys Live rows to the Pending board, re-reads the CA Tracker and Manifest Control, and refreshes reminders. On the 5th it chases missing dates; on the 7th it makes the monthly arrivals report. |
| 09:00 | Command Center daily email. |
| 10:00 | Penny sends Ariel's update list. |

The web app reads Google Sheets with a **read-only** key, so Google itself refuses any write. That already enforces your "never write to these sheets" rule.

### Pages today

Overview · Tasks · Pending (editable board) · Billing · Cash advances · Manifest · Arrivals (with the monthly report slides) · Settings.

### How sign-in works today

- People sign in with a **username** and password (for example `oliverapollo`). Passwords are stored scrambled with a strong method (scrypt), so nobody can read them back, including me.
- Five wrong tries lock the account for 15 minutes.
- New people get a one-time "set your password" link. The link is made by running a command on your Mac (`npm run invite`, `npm run team`). There is no Users screen.
- A sign-in lasts **30 days**. There is no one-time code, no time-out when idle, and no way to deactivate someone.
- There are five roles: `coo` and `cfo` (everything), `billing` (Jonathan: the Billing page), `support` (Ariel: all shipments and uploads) and `handler` (own clients only).
- The app's code checks access on every save. I found it consistent, with no gaps. **The database itself does not check access.**

### Database tables today (15)

| Table | What it holds |
|---|---|
| `users`, `sessions` | Logins, and who is signed in |
| `handlers`, `clients` | Account handlers and the clients each one covers (one handler per client) |
| `shipments` | The Pending board: JO, BL, client, commodity, mode, FSA, ETA, ATA, status, delivery date, plus import bookkeeping |
| `imports` | A log of every uploaded file |
| `settings` | App switches (reminders on/off, email addresses) |
| `pending_snapshots` | Weekly copies of the board, for the "last week" figures |
| `source_snapshots` | The last good copy of the CA Tracker and Manifest sheets |
| `billing_marks` | "Already billed" ticks made in the app |
| `reminders`, `reminder_log` | Handler reminders, and everything that was sent |
| `arrivals`, `arrival_history`, `monthly_reports` | The year's arrivals and the monthly report |

There is **no change log** today. The only history is "last updated by" on a shipment and the upload log.

---

## 3. Is it a sound base?

**Yes.** The code is small, tidy and well tested. It handles Manila time carefully, keeps the Google Sheets read-only by design, shows a preview before an upload is saved, and does the sign-in basics properly. Building inside it keeps one app, one login and one database.

Three parts of the plan cannot reuse what exists and need new work:

1. **Sign-in.** It needs email login, a code on new devices, the 12-hour idle rule, a Users page and deactivation.
2. **Access enforced by the database.** Nothing like this exists yet.
3. **The job record.** `shipments` is a thin board record of about 20 fields. Replacing LogiSys needs about 100 fields, plus parties, containers, items, files and milestones. I propose new tables for jobs rather than stretching `shipments` (section 5).

---

## 4. Risks and things to check

Most serious first.

1. **HIGH: the test links might use the live database.** If `DATABASE_URL` in Vercel is ticked for *Preview* as well as *Production*, every test link reads and writes live data. **Please check this before I push anything** (steps in section 10B). As a second lock, the test version will refuse to run unless its database is marked as the test database.
2. **HIGH: the live database may be readable through Supabase's web address.** Every Supabase project has a public web address and a "public" key. Any table without row-level security can be read through that address by anyone who has the key. None of the 15 tables have row-level security switched on. The app neither uses nor publishes that key, so this is not an open door today. If the key ever leaked, though, the users table (with its scrambled passwords) and every shipment would be exposed. To check: Supabase → live project → **Advisors → Security Advisor**. If it lists "RLS disabled in public", this is the problem. The build fixes it by switching row-level security on for every table, and the app keeps working.
3. **MEDIUM: backups.** The README set the live project up on Supabase's free plan. Once the new system replaces LogiSys, that database is the only copy of your job records. The free plan does not include the daily backups of the Pro plan (about US$25 a month). I recommend moving live to Pro before real data entry starts, and at the latest before the December side-by-side run.
4. **MEDIUM: your milestone list and Penny disagree on some stages.** Your list puts Draft Documents, Checking of Documents and Original Docs under *In transit*; Penny and the importer count them as *Clearing*. Your list puts Delivery Advised to Client under *Released*; Penny counts it as *Delivered* (your decision of 28 Sep). My recommendation is in section 11, question 1.
5. **MEDIUM: the timeline.** 9 October is seven working days away. Section 9 splits what will be ready then from what follows during October. Holding the date needs your answers to section 11 by Friday 2 October.
6. **LOW: two job lists until cutover.** Until December the existing Pending board (fed from LogiSys) stays as it is, and the new job records sit beside it, fed by the same daily feed. Anything typed only into the test system will not appear on the live board. That is expected in a test, but worth knowing.
7. **LOW: Vercel locks the test links.** Vercel normally asks for a Vercel-account login before opening a test link, and your team won't have one. Either switch Vercel's login off for test links (the app has its own sign-in), or I give you shareable links.
8. **LOW: scheduled jobs don't run on test links.** Vercel runs the 08:30 and 09:00 jobs only on the live site. On the test site, Admin will pull the daily LogiSys feed with a button, unless you want me to schedule it.
9. **LOW: the Vercel plan.** Vercel's free Hobby plan is for non-commercial use only. If the project is on Hobby, move it to Pro (about US$20 a month per member) before the team relies on it.
10. **LOW: the database connection doesn't verify the server's certificate.** That leaves a small risk of someone intercepting the connection. It is an easy fix during the build.
11. **LOW: the Command Center's own rule file (`CLAUDE.md`) describes the old setup:** username login, "Welcome Sir", the old roles and the old colours. I'll update it with the new rules so future work follows them.

Also confirmed from your data: LogiSys Live has **1,308 rows**. Its FSA numbers have turned into dates (e.g. `1979-12-25`, `0014-01-26`), as you said. Its Account Handler column is empty, so imported jobs will take their handler from the client's assigned handler.

---

## 5. Proposed approach

**Where.** In the `philindo-command-center` repo, on a new branch called `ops-system`. Each push gives a test link that runs on the test database. I have read-only access to that repo today, and I'll need push access once you OK the plan.

**New jobs beside the old board.** New tables hold the full job record; this becomes the official record. Until cutover, the 08:30 run updates both the old Pending board (as now) and the new jobs from LogiSys Live. At cutover, the Pending board, the Arrivals report and Penny switch to the new jobs, and the LogiSys import is switched off.

**Sign-in.** Keep the app's own sign-in, which is well built, and extend it:
- Work email and password.
- The first time someone signs in on a device, they get a 6-digit code by email. The device is then remembered for 90 days.
- People are signed out after 12 hours without activity.
- Five wrong tries lock the account for 15 minutes, as now.
- Admin invites people from a Users page. The invite email has a set-password link that works for 3 days.
- Admin can change roles and deactivate leavers. A deactivated person's sessions and remembered devices end at once, and their name stays on all history.
- There is a "Forgot password" link on the sign-in page. Your brief doesn't mention it, but without it Admin would have to re-invite anyone who forgets.

**Access enforced by the database.** Whenever the app uses the database, it first tells the database who the user is. The database then applies its own rules (this is "row-level security"). For example, if an Operations user tries to edit a job for another handler's client, the database refuses, even if a screen had a bug. This gives the same protection as Supabase's built-in version, without rebuilding the app around Supabase's sign-in.

**Change log.** The database itself writes it, on every create, edit and status change: who, when, which JO, which field, the old value and the new value. Because the database writes it, no screen can skip it. Nobody can edit or delete it through the app, not even Admin. (Only the database's owner account could, and nobody uses that account day to day.)

**JO numbers.**
- A job gets its number on its first save, including when it is saved as a draft.
- The number is taken inside that same save. Two people saving in the same second can't get the same number, and a save that fails doesn't use one up.
- Format: prefix + MMYY of the month it was saved + `-` + a 4-digit running number, e.g. `IMP1026-1248`.
- There is one counter per year, shared by all prefixes (your data supports this; see section 11). It resets to 0001 on 1 January.
- At cutover, Admin sets the starting number once, from LogiSys's last number. On the test system, numbers start at **9001**, so they can never clash with numbers LogiSys is still issuing.
- Numbers are never edited or reused. Cancelled jobs keep theirs. If someone picks the wrong mode, they cancel the job and create a new one, because the prefix can't change.

**Milestones.** Admin edits the list for each mode: each step's name, order and stage, which team may tick it, and the LogiSys status wording it matches. Every job gets its own copy of the steps, each with a plan date, actual date, handled by and remark. Entering an actual date is the update: the job's current milestone becomes the latest step done, its stage follows from that step, and "days since last update" restarts.

**Loading from LogiSys.**
- For 9 October, all 2026 jobs are loaded from LogiSys Live (read-only). Each job gets its current LogiSys status as a completed milestone, dated with the Completed Milestone Date. Earlier steps stay blank until the full export arrives.
- A problems screen comes first (see Migration in section 8).
- After that, the daily feed keeps statuses current but never overwrites anything a person typed into the new system.
- Later, the full LogiSys export with milestone history can be uploaded. **I'll need a sample export file** to build that part.

**Penny at cutover.** The app gets a private, read-only web address that returns jobs in exactly LogiSys Live's 34-column layout, plus ETA history. Penny gets one switch, from "sheet" to "new system", that changes only where she reads from. Her queues and emails stay the same, and her tests are extended. I build this in October and you flip the switch in December. A new job shows up at that address as soon as it is saved. Penny, though, stays on the sheet until cutover, so test jobs never trigger real emails.

**Keeping the test system safe.** The app knows when it is running as a test link. In that case:
- Every page shows a "TEST SYSTEM" banner.
- Every email except sign-in codes goes only to one test inbox, so daily client reports never reach real clients.
- The app refuses to start unless its database is marked as the test database.
- The test database is updated automatically on every push. The live database is never changed automatically.

**Look and feel.** The new pages and the sign-in screen follow the website redesign: white and #F5F7F3 backgrounds, greens #34A853 and #1E7A3A, the SF Pro font with Inter as fallback, pill-shaped buttons, 22 px rounded cards, and a frosted-glass sign-in card. The existing pages move to the same colours and fonts during October. The door and vault animations after sign-in stay, unless you'd rather drop them.

---

## 6. Database design

Three existing tables change, 18 tables are new, and row-level security is switched on for every table. Field names below are in plain words; "→" means "points to a record in another table".

### 6.1 Sign-in, users and history

| Table | What it holds |
|---|---|
| **users** *(changed)* | **Adds:** email (the sign-in name, must be unique), role (one of the seven below), active yes/no, deactivated on/by, invited by. **Keeps:** name, scrambled password, handler link, lock-out counters, last sign-in. Usernames are retired once everyone has an email set. |
| **sessions** *(changed)* | **Adds:** time of last activity (for the 12-hour idle rule) and device →. |
| trusted_devices | user →, device key (scrambled), label (e.g. "iPhone Safari"), first and last seen, remembered until, revoked on |
| login_codes | user →, code (scrambled), device, expiry (10 minutes), tries, used at |
| password_links | user →, link (scrambled), purpose (invite or reset), expiry, used at |
| sign_in_log | user, when, device, result (signed in / wrong password / code sent / code accepted / locked) |
| **change_log** | when, user → and their name, table, record, JO, action (create / edit / status / cancel), field, old value, new value. Written by the database; can't be edited. |

Roles: `admin` · `management` · `operations` · `documentation` · `manifest` · `billing_ca` · `transport`.

### 6.2 Clients and parties

| Table | What it holds |
|---|---|
| **clients** *(changed)* | **Adds:** reference type (FSA / PO / Invoice), default delivery address, daily report on/off, report emails (to / cc), party → (its entry in the address book), active. |
| parties | The saved address book. Name, kinds (consignee, customer, shipper, notify, origin agent, destination agent, selling agent; one party can be several), address lines, city, country, contact person, phone, email, active. It warns about duplicate names. |

### 6.3 Jobs

**jobs**: one row per JO.

| Group | Fields |
|---|---|
| Job | JO (unique, fixed), prefix, running number, month opened, mode (Sea import / Air import / Brokerage only / Export / Trucking only), cargo type (FCL / LCL / Air / Break bulk), consol type, delivery mode, booking thru, booking date, **account handler → (required)**, state (Draft / Open / Closed / Cancelled, with the reason, who and when) |
| Client | client →, client reference and its kind (FSA for Unilab; PO or invoice for others; always stored as text), delivery address |
| References | MBL/MAWB + date, HBL/HAWB + date, BL issued by, consol no., carrier booking ref, shipper's ref, PO/con ref, lead no., sales person, business dims, contract, AMS BL no., registry no., invoice value + currency, last free date, G.O. date |
| Routing | origin, place of receipt, loading port, discharge port, place of delivery, destination, trade lane, shipping line / airline, vessel & voyage / flight, ETD, ATD, ETA, ATA, incoterms, movement type, de-stuffing at, container return location, co-load type, agent name, agent BL no. + date, release type, remarks |
| Goods | description, commodity, packages + unit, gross wt, net wt, volume, chargeable wt, chargeable volume |
| Status *(filled automatically)* | current milestone, stage, time of last update; plus a customer remark that appears on the client report |
| Bookkeeping | created by/on, last edited by/on, source (new system / LogiSys), LogiSys's last status text (until cutover), and which fields a person typed (so the feed never overwrites them) |

| Table | What it holds |
|---|---|
| job_parties | job →, role (consignee, customer, shipper, notify, origin agent, destination agent, selling agent, consigned to order), party →, and the address as used on this job. The address is copied at save, so later address-book edits don't change old jobs. |
| job_containers | job →, container no., type (20GP, 40HC…), shipper seal, carrier seal, customs seal, CTO seal, tare weight. The container number's check digit is verified, with a warning if it's wrong. |
| job_items | job →, line no., description, container no., quantity, value, currency, HS code, country of origin |
| job_documents | job →, document type, received / missing / not needed, received on, the file (once uploads are on), uploaded by/on |
| document_types | Edited by Admin: BL, commercial invoice, packing list, permits… and which modes need each one |
| jo_counters | year and the last number used. (If you choose a separate counter per prefix, it becomes year + prefix.) |

### 6.4 Milestones

| Table | What it holds |
|---|---|
| milestone_steps | Edited by Admin: mode, order, name, stage (In transit / Arrived / Clearing / Released / Delivered / Closing), which team may tick it, the LogiSys wording it matches, active. It starts with the 27 sea import steps from your brief. |
| job_milestones | job →, step →, plan date, actual date (and time), handled by → user, remark, entered by/on, source (a person or the LogiSys feed) |

### 6.5 Migration

| Table | What it holds |
|---|---|
| migration_batches | uploaded by/on, source (LogiSys export file or LogiSys Live), file names, state (checked / imported / abandoned), counts (new / updated / skipped / problems) |
| migration_rows | batch →, JO, the row exactly as read, problems found, and what will happen to it (add / update / skip) |

### 6.6 Daily client reports

| Table | What it holds |
|---|---|
| client_report_sends | client →, report date, sent by/on, how (email or copied for Viber), recipients, and a copy of what was sent |

**Unchanged:** handlers, shipments, imports, settings, pending_snapshots, source_snapshots, billing_marks, reminders, reminder_log, arrivals, arrival_history, monthly_reports.

---

## 7. Who can do what

Your table, as the database will enforce it:

| | Admin | Management | Operations | Documentation | Manifest | Billing & CA | Transport |
|---|---|---|---|---|---|---|---|
| Jobs | Create, edit all | View | View all; create and edit own clients' | Edit all | View | View | View |
| Milestones | All | View | Own clients' jobs | All | Manifest steps | Billing steps | Delivery steps |
| Migration | Run | View | — | — | — | — | — |
| Users | Manage | View | — | — | — | — | — |
| Milestone lists, document types, clients | Edit | View | — | — | — | — | — |
| History (change log) | All | All | Jobs they can see | Jobs they can see | Jobs they can see | Jobs they can see | Jobs they can see |

Assumptions for you to confirm:
- Operations can *see* all jobs but edit only their own clients' jobs. Today, handlers see only their own clients.
- Documentation can't create jobs, since your table gives them "Edit".
- Admin assigns each milestone step to a team. My suggestion: Billing & CA = steps 25–27, Transport = steps 18–24, Manifest = to be confirmed with Danica.

**Existing pages under the new roles:**

| Page | Who |
|---|---|
| Overview, Arrivals | Admin, Management |
| Billing, Cash advances | Admin, Management, Billing & CA |
| Manifest | Admin, Management, Manifest |
| Pending (old board, until cutover) and Tasks | Admin, Management, Operations (own clients), Documentation (all) |
| Settings | Admin |

**Current people and proposed roles:**

| Person | Today | Proposed |
|---|---|---|
| Oliver | coo | Admin |
| Pablo | cfo | Management, or second Admin (your open question) |
| Jonathan | billing | Billing & CA |
| Ariel | support | Documentation (keeps the Unilab tracker upload) |
| Kim, Andrew, Cherry, Jena, Jimmy, Jasmin | handler | Operations |
| Danica | no login (receives manifest alerts) | Manifest |
| Transport | — | who? |

---

## 8. Page list

**New pages**

| Page | What it does | Who |
|---|---|---|
| Sign in | Email and password on a frosted-glass card over a soft green glow | Everyone |
| Sign-in code | Enter the 6-digit code emailed for a new device | Everyone |
| Set / reset password | Opened from the invite or "forgot password" email | Everyone |
| My account | Change password, see and remove remembered devices, sign out everywhere | Everyone |
| **Status board** | One row per open job: JO, client + reference, ETA, stage + milestone, handler, days since last update, and flags. Filters: mode, client, handler, stage. Search: JO, FSA, PO, HBL, container. On a phone the rows become cards. | Everyone |
| **New job** | The encoding form. A draft needs only mode, client and ETA. Warns about duplicate HBL/MBL. The JO is given on the first save. | Admin, Operations |
| **Job page** | One job, in sections: Job & client · Parties · References · Routing · Containers · Goods & items · Files checklist · Milestones · History. Editing depends on role. A job can be cancelled here. | Everyone (editing by role) |
| Milestone update | On the job page and from the board: tick a step and set the actual date, handled by and remark. Made quick to use on a phone. | By role |
| **Client reports** | The clients that get a daily report. Opening one shows the report sorted by client reference, with "Email" (one click, to the client's addresses) and "Copy for Viber". Shows when it was last sent. | Admin, Management, Operations, Documentation |
| Address book | Parties: add, edit, merge duplicates | Admin, Operations and Documentation edit; others view |
| Clients | Reference type, handler, delivery address, daily report on/off and its emails | Admin edits; Management views |
| Users | Invite, set role and handler link, deactivate and reactivate, resend invite, see last sign-in | Admin; Management views |
| Milestone lists | For each mode: add, rename, reorder, set stage, team and LogiSys wording, hide | Admin |
| Document types | The file checklist for each mode | Admin |
| **Migration** | "Load from LogiSys Live" or upload LogiSys files. The columns are matched, then a problems list appears: duplicate JOs, no client, unreadable dates, ATA equal to ETA, FSA shown as a date, a status that matches no milestone, and new client names. Then import. Keeps the history of every batch. | Admin runs; Management views |
| Change log | Search by JO, person, date or field | Admin, Management |

The existing pages stay: Overview, Tasks, Pending, Billing, Cash advances, Manifest, Arrivals, Settings.

**Status board flags** (Penny's rules):
- Arrived and not delivered: amber from day 2, red from day 4, critical from day 6, counted from the ATA.
- Stale: no milestone update for 8 days or more.
- No ETA.
- ETA passed with no arrival: amber after 1 day, red after 3 days, as in Penny's settings.

**Daily client report.** It lists the client's open jobs by client reference, plus any delivered since the last report. Columns: reference, JO, BL/HBL, containers, ETA/ATA, current milestone, customer remark. It is built fresh when opened, so it is always current by morning.

---

## 9. Ready on 9 October, and what follows

**Test version, Friday 9 October** (on the test database)

1. Sign-in with email, password and a new-device code; the 12-hour idle rule; the Users page; roles enforced by the database; the change log.
2. All 2026 jobs loaded from LogiSys Live after the problems screen. Statuses kept current from the daily feed (a button on the test site).
3. The new job form and job page with every field in your list; the parties address book; containers, goods and items; the file checklist (received / missing); JO numbering.
4. The sea import milestones (as an editable list), milestone updates and automatic stages; the status board with filters, search and flags; the daily client report with "Copy for Viber" and "Email" (to the test inbox).

**During October, as each input arrives**

- Import of the full LogiSys export with milestone history (needs a sample export).
- Air import and export milestone lists (needs your lists).
- File uploads. This needs a storage decision: Supabase's own file storage covers testing on the free plan (1 GB), but a year of BL and invoice PDFs needs Pro.
- Penny's read-only address and her switch (left off).
- The new look carried over to the existing pages.
- Fixes from the team's testing.

**December:** the side-by-side run with LogiSys, then the cutover steps:
- Set the JO counter from LogiSys's last number.
- Run a final import.
- Switch Penny, the Pending board and Arrivals to the new jobs.
- Switch the importer off.

---

## 10. Test database: what you set up

Keep passwords and keys out of the chat. They go only into Supabase and Vercel.

**A. Supabase (about 10 minutes)**

1. supabase.com → your organisation → **New project**. Name it `philindo-ops-test` and choose the same region as the live project. Create a strong database password and save it in your password manager.
2. When the project is ready, click **Connect** at the top of the project page, then **Session pooler**, and copy the connection string. Put your database password where it says `[YOUR-PASSWORD]`.
3. That's all for Supabase. I create the tables automatically on the first push.

**B. Vercel (about 10 minutes)**

1. Open the project → **Settings → Environment Variables**. First check `DATABASE_URL`: it must be ticked for **Production only**. If Preview is ticked too, untick it and let me know.
2. Add the following, each ticked for **Preview only**:

| Name | Value |
|---|---|
| `DATABASE_URL` | The test connection string from step A.2 |
| `CRON_SECRET` | Any long random text, different from the live one |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The same value as in Production (the read-only Google key) |
| `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | The same values as in Production (used to send sign-in codes) |
| `TEST_MAIL_TO` | Where the test system's other emails go, e.g. `transport@philindo.com.ph` |
| `FIRST_ADMIN_EMAIL` | Your work email. The test system invites you as its first Admin. |

3. **Settings → Deployment Protection:** switch Vercel Authentication off for Preview deployments, or leave it on and I'll give you shareable links.
4. *Later, only for file uploads:* the test project's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API). The service-role key is a master key, so paste it only into Vercel.

**C. GitHub:** when you give your OK, I'll request push access to `philindo-command-center` from this session, and you only need to approve it.

**D. Live project check (risk 2):** Supabase → live project → **Advisors → Security Advisor**. Tell me whether it shows "RLS disabled".

---

## 11. Decisions I need

1. **Stages vs Penny.**
   - *My recommendation:* keep your new list for the new system (the three document steps under In transit, and Delivery Advised to Client under Released). The new system has a real "Goods Delivered" step, so it no longer needs the 28 Sep workaround.
   - Penny keeps her current rules while LogiSys is the source. At cutover, the new system gives her each job's stage and delivery date directly, so the two can't disagree.
   - OK?
2. **The JO counter.** Your data shows IMP and AIMP share one counter: IMP0126-0001, IMP0126-0002, **AIMP0126-0003**, IMP0126-0004; later IMP0926-1212, **AIMP0926-1213**, **AIMP0926-1214**, IMP0926-1215. There are no EXP or TRK numbers in the data I can see.
   - Do EXP and TRK share it too?
   - Two oddities to check in LogiSys: both IMP0826-1174 and AIMP0826-1174 exist, and AIMP0926-1149 carries an August-range number.
   - I also saw one number, `ASL2609-0526`. What is ASL?
3. **What Operations can see:** all jobs (editing only their own clients'), or only their own clients' jobs as today?
4. **Pablo:** Management or second Admin? (Your open question.)
5. **A sample LogiSys full export file** (any month), so I can build the milestone-history import.

Your other open questions (the milestone names marked "?", hidden step 7, the air import and export lists, which clients get a daily report and at which emails) are needed during October, not for this OK. One hint from the LogiSys status wording Penny already uses: step 23 is probably **"Container Delivery Date"** and step 24 **"Empty Container Received After Delivery"**.

**Reply "OK" with any changes, and I'll start.**
