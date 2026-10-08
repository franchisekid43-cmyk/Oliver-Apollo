# Penny — installation

Six Apps Script files plus `appsscript.json`. Tested: **145 checks passing** (`node penny_tests.js`),
covering the acceptance criteria in `docs/PROMPT_penny_pending_agent.md` — the free-time ladder,
the earlier-vs-later ETA asymmetry, the 8-day staleness rule, routing, silence, and a write audit.

Penny reads `LogiSys Live` and `LogiSys Archive`, which the **LogiSys importer** writes
(`../importer/`). Install the importer first; until it runs, `bootstrapFeedSheets()` gives
you empty sheets to test against.

## Install

Penny sends from **ops.philindo@gmail.com** (shown as "Penny"). Apps Script sends mail as the
account that installs the trigger, so do every step below **signed in as ops.philindo@gmail.com**.
That account needs **edit** access to the feed workbook (to write Penny Arrivals) and **view**
access to the CA Tracker. If Penny ever runs as another account she sends nothing to handlers
and tells the COO.

1. Open the Google Sheet that will hold **LogiSys Live** (the one the importer writes to).
   **Extensions → Apps Script.**
2. Create six files and paste in the contents of each:
   `Config.gs` · `Lib.gs` · `Queues.gs` · `Arrivals.gs` · `Email.gs` · `Main.gs`
   In **Project Settings**, set **Time zone** to **(GMT+08:00) Manila** — every date calculation
   relies on it, and Penny refuses to run on any other. (A script bound to a sheet starts on
   the sheet's time zone, which is often not Manila.)
3. In `Config.gs`, fill in the two blank handler addresses (Andrew Mausig, Jasmin Sawal).
   A blank address routes that person's shipments to the COO with a visible note — nothing is dropped.
4. Run **`bootstrapFeedSheets()`** once if the importer has not run yet. It creates `LogiSys Live`
   and `LogiSys Archive` with the correct headers. It never touches a sheet that already exists.
5. Run **`dryRun()`**. The execution log prints every queue and every email it *would* send,
   one line per shipment, and sends and writes nothing.
6. When the log looks right, run **`setup()`**. Installs the 07:45 Asia/Manila trigger
   (Monday–Friday, weekends skipped in code) and does one live run.

## The functions

| Function | What it does |
|---|---|
| `setup()` | Installs the 07:45 trigger, then runs once |
| `dryRun()` | Logs everything, sends nothing, writes nothing |
| `runPenny()` | The real run |
| `bootstrapFeedSheets()` | Creates LogiSys Live + Archive with correct headers, if they don't exist |

## Where the shipments come from — Philindo One

```
FEED_SOURCE:      'philindo-one'      // or 'sheet' for LogiSys Live / LogiSys Archive
PHILINDO_ONE_URL: 'https://philindo-command-center-git-ops-system-philindo.vercel.app'
```

Penny reads Philindo One's read-only Penny feed (`/api/ops/penny-feed`, built in the Philindo One
system): this year's jobs in the same 34 columns as LogiSys Live, plus every ETA change. She never
writes to Philindo One. What changes:

- **Handlers** come from Philindo One (the client's assigned handler), so far fewer shipments
  arrive with "no handler".
- **Status, stage and delivery** are Philindo One's, including what the team updates there. A job at
  stage Delivered or Closing, or with a delivered date, is never chased.
- **ETA changes** come from Philindo One's change log: the first change since Penny's last morning run.
- **New job orders** are the ones she had not seen at her last morning run (she keeps the list in
  Script Properties). On her first morning on Philindo One there is no list yet, so they start the
  next day, and the email says so.
- **Penny Arrivals** and the monthly report are counted from Philindo One's jobs.
- **Ariel's list is cross-checked with this morning's LogiSys report.** On the test link,
  Philindo One brings in the 06:00 LogiSys report only when someone opens its dashboard or
  Shipment Board, so at 10:00 it can still hold yesterday's state. A job that today's LogiSys Live
  already shows as updated is left off Ariel's list; the log names each one. (Team report, 8 Oct.)

**Switching it on (once):**

1. In Vercel, on the Philindo One project, add an environment variable `PENNY_FEED_TOKEN` with a
   long random value. Add it for the environment that `PHILINDO_ONE_URL` points to (Preview, branch
   `ops-system`, for the test link). Then redeploy.
2. In Penny's Apps Script project: **Project Settings → Script Properties → Add script property**.
   Set `PENNY_FEED_TOKEN` to the same value. The token is never written in the code.
3. Run **`dryRun()`** once from the editor, signed in as ops.philindo@gmail.com. Google asks to allow
   "Connect to an external service". Allow it, or the 07:45 trigger can't reach Philindo One. The
   log's `Data:` line says which source was used.

**If Philindo One can't be read** (no token, a wrong token, the site down, an empty feed), Penny uses
the LogiSys Live sheet that morning, as before. The COO's email says why, so a day is never skipped.
Set `FEED_SOURCE: 'sheet'` to stop using Philindo One.

## Who receives email — today

| Who | When | What |
|---|---|---|
| COO | 07:45 | Every pending shipment, with its handler |
| Ariel | 10:00 | Only the shipments he needs to update in LogiSys (stale status, no ETA, arrival date to confirm) |
| Handlers | — | Nothing until `TEAM_EMAILS` is `true` |

Ariel's 10:00 email is its own trigger (`runArielReminder`), switched by `ARIEL_REMINDER` and
independent of `TEAM_EMAILS`. Install it with `setupArielReminder()` — it sends nothing when run.
`dryRunAriel()` shows what it would send.

## Who receives email — two switches

```
TEAM_EMAILS: false   // handlers and Ariel receive nothing; the COO gets everything
SHADOW_TO:   ''      // an address here receives every email instead of its recipient
```

- **`TEAM_EMAILS: false`** (current, COO's decision 28 Sep 2026): only the COO's email goes out.
  It carries every pending shipment with its handler next to the client. Set to `true` when
  the COO says the team should start receiving theirs.
- **`SHADOW_TO`**: while it holds an address, every email Penny sends goes there instead,
  with a line at the top naming who it was for. Use it to preview the team's emails before
  switching them on.

## What Penny writes

Only sheets she creates, all in the feed workbook:

- `Penny Arrivals` — refreshed every working morning
- `Penny Monthly <Mon YYYY> — SEA FCL / SEA LCL / AIR` — three register tabs, generated on
  the first working day on or after the 7th

She never writes to the CA Tracker, the Billing Tracker, the Manifest Control,
`LogiSys Live`, `LogiSys Archive`, or any Philindo web app. `ownSheet_()` refuses any other
name, and the test suite audits every write verb in the script and runs a full morning
against fake sheets to confirm nothing else is touched.

## Arrival — one switch

```
TRUST_LOGISYS_ATA: false
```

LogiSys writes its ETA into the ATA field (28 Sep 2026: 33 of 87 arrival dates disagreed with the
tracker, all in one direction). While this is `false`:

- a LogiSys ATA **different** from that row's ETA is taken as the arrival date;
- an ATA **equal** to the ETA is not trusted. If a post-arrival milestone
  (`Container Discharged`, `DO Issued`, `Gatepass Released`, `Payment of Duties and Taxes`,
  `Final Assesment`) says it arrived, it goes to Ariel as "arrival date not confirmed";
  otherwise it is treated as not yet arrived and listed for the COO under "LogiSys ATA not used".

Set it to `true` once Ariel updates LogiSys directly. `arrivalOf_()` is the only place it is read.

## Free time

```
STORAGE_FREE_DAYS   = 5   // port storage max free  -> charges from day 6
DEMURRAGE_FREE_DAYS = 7   // line container min free -> charges from day 8
RED_LEAD_DAYS       = 2   // red sits this many days before the first charge
```

Queue 1 goes **red on day 4** (two days before the first charge) and
**critical on day 6** (storage running, demurrage two days out). Both are derived by
`q1Thresholds_()`: change a free period and every threshold moves with it.

## Decisions made in code that the COO may want to revisit

- **CRITICAL in a subject line** is triggered only by shipment-risk items (queues 1, 2, 5b, 5c).
  Stale status and missing ETAs (queues 4 and 5a) are data work for Ariel and never make a
  subject CRITICAL — soul.md: "those words are budget, not decoration".
- **"Status to check" only where an update is due** (team report, 8 Oct 2026). A shipment still on
  its way (ETA today or later) is not chased: its next update is the arrival. A job with nothing
  recorded yet (no status, no dates) is treated as not yet booked. Once the ETA has passed with
  no arrival, the line says so: "ETA was 2 Oct, arrival not recorded yet".
- **Only this morning's report is queued.** A JO whose row in LogiSys Live carries an older
  Source Report Date has dropped out of the LogiSys report and is not chased.
- **The COO email is silent** on a morning with nothing amber or red, no new JOs and no notes.
- **Ariel receives only shipment updates** — stale status (queue 4) and missing ETAs (queue 5a),
  the data he maintains in LogiSys. He is never sent another account's shipments: a shipment
  with no handler goes to the COO with a note, and he is not copied on red "ETA passed" items
  (COO's decision, 28 Sep 2026; this overrides the "handler not set → Ariel" rule in the spec).
  His address: `arielcaingcoy@philindo.com.ph`.
- **Penny sends from ops.philindo@gmail.com** — `CONFIG.SENDER_ACCOUNT`. The importer reads
  franchisekid43@gmail.com; the two are separate accounts on purpose.

## Running the tests

`penny_tests.js` runs the whole logic under Node with the Apps Script services stubbed:

```
node penny_tests.js
```

It is not needed in production — it is there so any change can be re-verified before it goes live.
