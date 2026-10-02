# Philindo One — test version: set-up and what to try

*1 October 2026 · Parts 1–4 of the build brief, in the look of the new Philindo website, on the test system only.
The live Command Center, the CA Tracker and Manifest Control are not touched.*

## Status, 2 October (morning)

**Set up and working:** test link `philindo-command-center-git-ops-system-philindo.vercel.app` (every push to
`ops-system` updates it), its own Supabase test project `philindo-ops-test` (Singapore), Oliver signed in as Admin.
Loaded on the test link: the LogiSys Sea and Air registers (1,309 jobs) and the Organization list (729 address-book
entries).

**2 October — decided: the CA Tracker and Manifest Control stay the record.** The system will write each submission
into them, the way their apps do now. **Don't press Switch-over.** Waiting on you: the CA Tracker's Code.gs pasted into
a Google Doc, and test copies of both sheets shared with the system's Google account as Editor.

**2 October (night) — password links say what happened.** A password link (invitation or new password) now says
straight away, before anything is typed, if it can't be used: **already used** — the password is set, so sign in;
**expired** — **Get a new link** sends a fresh one by email; **replaced** — a newer email was sent, so use that one. The
invitation email also says where to sign in afterwards, because the link works only once. In **Admin → Users & roles**
the Status column shows "Invited, no password yet" or "Invited, link expired" for anyone who hasn't chosen a password.

**2 October (night) — every request collated for Jameson, and a tidier menu.** Every request for the processors comes
to Jameson and goes into one dispatch per day; the board says when it is ready to post, when he posted it, and what came
in or was cancelled since — **Copy only what's new** gives a short update. The menu: **Help** and **Notifications** are now
the last items under **Admin** (the number beside Admin shows new notifications); for you and Pablo, **Team dashboards**
is under **Dashboard** (with **Main dashboard**).

**2 October (night) — Dispatch for the processors.** Account handlers ask for a processor for tomorrow (or today):
job order, what to do, where, notes. Jameson (role **Head dispatcher**) gives each job to a processor, sets the order and
copies the day's dispatch for the processors' Viber group — written for him. EA, Gemmar, Marlon and Elvin (role
**Processor**) open **My jobs** on their phones: one job at a time — On my way, I'm here, Done or Problem — with remarks,
photos and where they are; then the next; a thank-you at the end. Every update is kept, and the account handler and
Jameson are told through **Notifications** (with pop-up alerts if they allow them). When you invite them, give Jameson the role
**Head dispatcher** and the four the role **Processor**; each needs an email they can open on their phone (the sign-in
code goes there the first time).

**2 October (night) — the system is now called Philindo One.** The sign-in page, the welcome ("Welcome to Philindo
One"), the tour, the menu (Philindo One, with Philindo Logistics under it), page titles, the invite and sign-in
emails, printed forms and the name under the icon when it is added to a phone all say Philindo One.

**2 October (night) — Viber update for account handlers.** **Shipments → Viber update** (and a button on each
handler's dashboard): pick a client and the system writes the status message for their Viber group chat in your
template — `-NAME PORT BL PO`, Supplier, ETA, and the status in bold, ending "Thank you / OPS". The handler checks three
things per shipment: the **name** the client knows it by (MILKLAB, BBS PREMIUM — typed once, then remembered for that
supplier), the **PO number from the invoice** (or the invoice number), and the **status** (suggested from the steps
ticked on the job, or their own words like *IED DEBITED*). **Copy for Viber** copies it to paste in the group chat; what
they typed is kept for next time. Handlers see only their own clients. The client report's **Copy for Viber** now uses
the same format. The tour has a new chapter for it, right after updating a shipment's status.

**2 October (evening) — welcome and a first-time tour.** Everyone gets the big **"Welcome {first name}"** when they
sign in, and it fades into their own dashboard. The **first time** someone signs in, it also says a short tour is ready,
and the tour opens: it walks them through the real pages with the rest of the screen dimmed and the part being explained
lit up, with a card in plain words — **encode a shipment → update its status → Viber update → ask for a cash advance → liquidate →
offset → follow the statuses** for account handlers; the billing team, Finance and the manifest team get their own
steps; you and Pablo get every team's. The tour only shows: the page can't be clicked while it's open, so nothing is
typed, saved or sent. **Not now** or **×** closes it for good; it is always under **Admin → Help** in the menu,
where the same steps are written out and each part has **Show me**. Everyone, you included, sees it once.

**2 October (afternoon) — each team has its own dashboard.** After signing in, account handlers, the billing team and
Finance each land on **My dashboard**, built for their job. You (Admin) and Pablo still land on the main Dashboard; the
menu has **Dashboard → Team dashboards**, with buttons on top to see exactly what each team sees (and a list to pick any account
handler).
- **Account handler:** their accounts' open shipments (arrived first, oldest first; **Update status** opens the job),
  **New job**, **New CA request**, **Offset request**, their cash advances (with **Liquidate** and the due date),
  liquidations, offsets, container deposits, and billing on their accounts (delivered but not yet with billing; with
  billing, not yet billed; billed this month).
- **Billing team:** what is **ready to forward to Finance** (every document in hand — the **Forward to Finance** button
  opens the billing update with that status chosen), what is with them not yet billed, the delivered job orders that
  have **not reached them yet, grouped by account handler** so they can follow up, and what was billed this month.
- **Finance:** every CA request, release, liquidation (with how many receipts and files) and offset waiting for them,
  each with its button; then the summaries: liquidation status, shortfalls and excess, unliquidated cash by account
  handler with how old it is, billing, container deposits.
- **Liquidation overdue now counts.** The CA Tracker only learns a job's delivery date when the liquidation is filed,
  so it never shows a cash advance as overdue before then. The system now takes the delivery date from the shipment
  when the CA has none: today **39 job orders (about ₱6.6M) are past the 7 days**. Only shown, never written anywhere;
  the job order's page says "(from the shipment record)".
- **Each account handler's sign-in must be linked to their name** (Admin → Users & roles → Account handler), or their
  dashboard can't tell which clients are theirs — it says so.

**2 October (morning) — your asks:**
- **The cash advance pages now show everything on the CA Tracker** (and the manifest pages everything on Manifest
  Control), with no button to press: until the switch-over the system keeps its own copy of both sheets, replaced
  automatically within minutes whenever a sheet changes. The sheets are only read.
- **Every form opens as a preview** before the switch-over, so you can see exactly what the team will use: New CA
  request, Liquidate, Offset request, Billing update, and Finance's Decide / Release / Check / offset / deposit windows,
  plus the manifest Log a shipment form. Each says "Preview" and its send button is off until the switch-over.
- **CA status by account handler** (Finance → CA status by handler): pick a handler to see every cash advance of
  theirs, where it stands and what happens next. An account handler sees their own first ("My CA status").
- **Fixed:** the line under each page title was hidden on every page; it shows again. On phones, the wide fields
  no longer squeeze the date boxes.

**Phase 1 final build (1 October, late night) — everything in one system.** The CA Tracker app and the Manifest
Control app now live inside the system. How each person uses it: `docs/ops-system-team-guide.md`.
- **Cash advances** (Finance → Cash advances): account handlers raise **CA requests** (first or supplemental, invoices
  attached), **liquidate** (with receipts and the acknowledgement) and ask for **offsets**; **Finance** approves (in
  full or part) or rejects, **releases** the cash (cash, bank transfer, check or GCash; partial allowed), **verifies**
  or returns each liquidation, decides offsets, follows up **container deposits** and closes job orders. Each request
  and liquidation prints as a PDF form with signature lines.
- **Billing updates** (Finance → Billing updates): the billing team's form — status, the five documents, approval,
  confirmed amount, forward date. On Finance → Billing each unbilled row has a **Billing update** button.
- **Emails as before:** each liquidation goes to the accountant (acctg4@) with its receipts attached; the **Daily Cash &
  Billing Brief** goes to transport@ at 9 AM on weekdays; new requests and offsets can also go to Finance (an address
  is set on the Cash advances page — the old app sent nothing for these).
- **Manifest** (Shipments → Manifest): **+ Log a shipment**, the duplicate house-bill check ("log anyway" for split
  shipments), edit any entry, set it Manifested with its registry number; Admin has **Settings** (cutoffs, alert
  addresses, penalty, pick lists). Alerts go to the manifest staff, supervisor and escalation addresses, as before.
- **Fixed — manifest deadlines:** the board counted each deadline from the arrival date at midnight and ignored the
  tagging time, and read "CDEC" from the wrong column. It now counts back from the **tagging date and time** (sea 24 h,
  air 6 h), exactly as Manifest Control does. Example: MF-2609-031 (air, tagging 5 Oct 12:45) is due 5 Oct 06:45,
  not 4 Oct 18:00.
- **Nothing moves until you press the button.** Admin → **Switch-over**: "Copy and compare" reads the CA Tracker or
  Manifest Control (read only — the sheets are never changed) and shows its figures beside the system's; you can do it
  as often as you like. "Switch to this system" makes one last copy and from then on the team works here. On the test
  link this only affects the test system.
- **Checked against today's sheets:** unliquidated ₱10,405,034.37 / 78 job orders, billed, this month, archive and the
  35 manifest entries (18 draft, 17 manifested) all come across exactly. Known differences, all the sheets' own errors:
  the tracker's Dashboard counts only rows 4–100, so it shows 3 requests awaiting approval (₱866K) while 31 job orders
  (₱4.08M) have no approval and no cash released; IMP0826-1146's offset is counted wrongly by the tracker; IMP0926-1264
  and IMP0526-0941 have liquidations the tracker never picked up.
- **Roles to set before the team starts** (Admin → Users & roles): Vicky Mendoza → **Finance**; account handlers →
  **Operations**; Rapha and Than → **Billing & CA**; Danica → **Manifest**.

**What to try on the test link (in this order):**
1. Admin → Switch-over → Cash advances → **Copy and compare**; read the comparison. Then **Switch to this system**.
2. Do the same for Manifest control.
3. As a handler (or yourself): Finance → Cash advances → **New CA request**; attach an invoice; send.
4. As Finance: the request is in the **Finance queue** → Decide → approve part of it → **Release**.
5. As the handler: open the job order → **Set delivery date** → **Liquidate**; attach receipts; submit. Then
   **Offset excess** to another job order.
6. As Finance: **Check** the liquidation → Verified; decide the offset. Open the **PDF** buttons.
7. As the billing team: Finance → Billing updates → **New billing update** for the job order → Billed.
8. Shipments → Manifest → **+ Log a shipment**; try an HBL already logged; then open the entry and set it Manifested.
9. Switch-over → **Go back** returns the test system to reading the sheets (what you entered stays but stops counting).

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
- Menu: "Philindo Logistics" (since 2 Oct: "Philindo One" with "Philindo Logistics" under it), the green **New job** button on top, Address book and Clients at the bottom with Admin.
  Pages now fade when you click.

**Oliver's asks of 1 October (night):**
- **Menu:** only Dashboard, Shipments, Finance and Admin; click a section to open its pages. Shipments: Shipment Board,
  Monthly Shipment Report, Arrivals, Unilab Tracker, Pending Shipments, Manifest. Finance: Billing (unbilled),
  Unliquidated cash advances, CA requests. Admin: Client reports, Address book, Clients and the admin pages.
- **Shipment Board:** the date options are in one **Filter** drop-down.
- **Download register:** choose the columns and put them in your own order, left to right (drag, or the arrows); the
  window shows the Excel column letters and how the top of the file will look; layouts can be saved by name.
- **Arrivals:** the year month by month against the three years before, with animated charts (the current month drawn
  as "so far"), the split by mode, the busiest clients and jobs still waiting for dates.
- **CA requests:** every request on the CA Tracker and where it stands. Note: the CA Tracker's own Dashboard tab says
  3 requests pending approval (₱866K), while its rows show 30 with an amount waiting for approval (₱4.06M). The page
  shows both; worth checking which is right.
- **Read from documents** (New job): drop the BL/AWB, invoice and packing list; the system reads them and fills the form;
  a person checks it beside the documents and approves. Switched on once the Claude API key is added (below).

**Oliver's asks of 1 October (late) — the last Phase 1 features:**
- **Client reports:** shipments without an FSA/PO now come last, and "0 PKG" no longer shows.
- **Client tracking link** (instead of a customer portal): a private link per client, opened without signing in, showing
  their shipments as a table of raised 3D tiles (they lift toward the mouse) by stage — **Origin** (country) →
  **In transit** → **Customs clearance** → **Delivery** →
  **Delivered**. Each row shows just the shipment's details and its status (the stage, with the latest update under
  it). Opening a shipment shows its journey as one flat line — Origin · Departed · Arrived · Cleared · Delivered —
  filled in a glowing green up to where the shipment is and pale after, with a small ship, plane, truck or container
  at the front of the green and an icon under each stage point. The green fills in one stage at a time, each point
  lighting up as it is reached; then a soft light runs along it. The countries and dates are under the points, the
  details below. Delivered shipments stay on the page for 30 days.
  Made on Admin → Client reports → the client → **Make tracking link**; then **Copy link**, **Open**, **New link** (the
  old one stops working at once) or **Turn off**. While on, the link is added to the Viber text and the report email.
  Admin and Documentation can do this for any client, an account handler for their own clients; Management can only
  see and copy it. The page shows how often the client opened it (your own visits while signed in are not counted).
  A client sees only their own shipments and only: their reference, JO, BL, containers or packages, vessel/flight,
  shipping line/airline, from/to, dates, current status and the client remark — never amounts, parties or notes.

**Unbilled checked against the CA Tracker (1 October, night):**
- **Unbilled is not October only.** It is every job order the Billing Tracker still has as "For Billing" (any month),
  plus every shipment delivered from 1 September that no billing tab knows ("not yet with the billing team").
- **Fixed:** six Gentle Supreme jobs from August (IMP0826-1159, 1165, 1167, 1168, 1169, 1170) were left out because
  LogiSys has no delivery date for them and the system assumed August, though their cash advances were released on
  3 September. A job with a cash advance released from 1 September now always counts. Also IMP0826-1146.
- **Fixed:** IMP0826-1180 (Unilab) showed ₱0 because billing saved it again without the amount; it now shows the
  ₱346,017 billing entered earlier, marked as an estimate.
- With today's CA Tracker: **₱1.40M across 25 job orders** (was ₱0.86M / 18). Billing forwarded ₱8.3M to finance in
  September and ₱1.4M today, so only 3 job orders are left "For Billing".
- **Mark billed** now starts the date on 10 days after delivery (you can change it). To clear the older jobs already
  billed in your records: Finance → Billing → "Delivered, not yet with the billing team" → **Mark billed** → **Mark
  billed** on IMP0826-1165, 1167, 1169, 1170, 1146 (and 1159, 1168, which have no delivery date — pick the date).
- **Unliquidated ₱10.4M** matches the CA Tracker's own Dashboard exactly. ₱7.2M of it is on job orders already billed
  (liquidation is behind, not billing), ₱2.0M on shipments not delivered yet.

**To switch on document reading (about 10 minutes):**
1. Go to console.anthropic.com and sign up (or sign in) with the company email.
2. Add a payment method (Settings → Billing), then set a **monthly spending limit** (Settings → Limits).
3. Create an API key (Settings → API keys → Create key, name it "Philindo operations test"). Copy it — it is shown once.
4. In Vercel: the project → Settings → Environment Variables → Add: name `ANTHROPIC_API_KEY`, value = the key,
   environment **Preview** only (Production later, when we go live). Save.
5. Redeploy the test link (Deployments → the latest ops-system one → ⋯ → Redeploy), or tell me and I push.
6. Admin → Document reading then shows "On". Send me the documents of 10 past shipments (sea FCL, sea LCL, air, Unilab
   and others, at least one scan or phone photo) and we run the accuracy test against their LogiSys records.

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
email with a link to choose a password; you can also copy the link and send it by Viber. The link works once (3 days
for an invitation, 1 hour for a new password). Sending a new link cancels the older one, so tell them to use the newest
email. After choosing the password they sign in at the sign-in page, not from the email.

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
11. **Read from documents** (after the key is added): New job → drop the three documents → check the form against the
    documents (click a field: its words are marked on the page) → tick every HS code "verified" → Approve. The job opens
    with the files under "Documents on file" and the history says it was read from documents and approved by you.
    For a past shipment use "Accuracy check" at the bottom instead of approving, then Discard.
12. **Monthly report:** open September, compare with the Command Center's September report (after its 7 October run),
    open the slides, copy the Viber message. From 7 October, 8:30 AM, September's report appears on its own.
13. **Client tracking link:** Admin → Client reports → a client → **Make tracking link** → **Copy link**. Open it on your
    phone in a private window (so you are not signed in): tap the stage boxes to filter, search an FSA or container, open
    a shipment and watch the vehicle glide along its line. Check a few stages against the job pages. Then **New link** and open the old one: it
    must say "This link is not active". **Copy for Viber** now ends with the link.

14. **Team dashboards:** menu → **Dashboard → Team dashboards**. Click *An account handler* and pick a handler, then *The billing
    team*, then *Finance*. Check a few figures against the CA Tracker and the Billing page (they use the same
    numbers). On the Finance view, open a job order counted as *Liquidation overdue* and see where its delivery date
    came from. Try each view on your phone.

15. **Tour:** sign out and back in — the welcome, then the tour (it opens once per person). Click through it, try
    **Back**, close it with **×**, then open **Admin → Help** and use **Show me** on one part. On a phone the card
    sits at the bottom of the screen.

16. **Viber update:** sign in as an account handler (or as you: you see every client) → **Viber update** → pick a
    client. Compare the message with what you sent the client last; type a name (e.g. MILKLAB) on one shipment and see
    the others from that supplier follow; type a PO; change a status; untick one; **Copy for Viber** and paste it in a
    chat to yourself. Open the page again: what you typed is still there. Tick a step on one of those jobs, open the page
    again: it shows the new suggestion and **Keep mine**. On your phone, try **Share…**.

17. **Dispatch:** as an account handler, **Dispatch** → **Ask for a processor** → Today → a job order, PICK UP DO, a place and
    a note. Sign in as Jameson (Head dispatcher) on another browser: **Admin → Notifications** shows the request; give the
    job to a processor, add a second one and move it up with ▲; **Copy dispatch** and paste it to yourself. Then, as the
    handler, ask for one more job for the same day and cancel one: Jameson's board shows *Since then: 1 new, 1 cancelled*
    and the new job is marked **New since posted**; **Copy only what's new** gives a short DISPATCH UPDATE. Sign in as that
    processor on a phone: **On my way**, then **I'm here** with a photo and a remark, then **Done** — the next job comes up,
    and after the last one, the thank-you. Back as the handler: Notifications have each update; open the job to see the photo
    and the map link; send a remark — the processor's phone shows it. Try cancelling a job, and asking for another
    handler's job (it must be refused).

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
