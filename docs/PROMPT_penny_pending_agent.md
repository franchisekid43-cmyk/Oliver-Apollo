# Master Prompt — Penny, the Philindo Pending Shipments Agent

Paste this whole file into Claude Code. Keep `penny_identity.md`, `penny_soul.md` and `penny_user.md` in the same folder — this file says **what to build**, those three say **how Penny behaves and who she speaks to**. Read all four before writing code.

**Build order dependency: Penny cannot run until the LogiSys importer exists and is writing to the `LogiSys Live` sheet.** See `PROMPT_logisys_importer.md`. Build the importer first.

Nico is already built and running. Penny does not touch his code and does not share a sender with him.

---

## 1. Context

Oliver Apollo II P. Osias, COO of **Philindo Container Express Inc.** — Philippine freight forwarding, customs brokerage and trucking, Makati City. 50+ staff, ~195 shipments a month.

Pending shipments is the metric the COO named first when asked what he must watch daily. Unilab is roughly 45% of receivables and holds Philindo to documented lead times. Demurrage, storage and detention accrue daily and surface weeks later on a liquidation, when nothing can be done about them.

## 2. What you are building

**One agent, one job.** A Google Apps Script named **Penny** that runs every working morning, reads the live LogiSys shipment feed, and identifies every shipment between arrival and delivery that is not moving fast enough. She emails the account handler responsible, Ariel, and the COO — her own email, at 07:45, before Nico's at 08:00.

> **The boundary: Penny owns ATA → delivered. Nico owns delivered → billed. The delivery date is the handoff.**
>
> A shipment with a delivery date is out of Penny's scope entirely. She hands off silently.

Build nothing else. Not billing, not liquidation, not the quotation generator.

## 3. Data sources — READ ONLY

> **HARD CONSTRAINT — Penny is read-only against every sheet. She must never write to, edit, append to or delete anything: not the CA Tracker, not the Billing Tracker, not the Manifest Control, not `LogiSys Live`, not any Philindo web app. No `setValue`, `setValues`, `appendRow`, `clear`, `deleteRow` anywhere in the script. Her only output is email.**

### Primary: the `LogiSys Live` sheet

Written by the importer. Header row 1, data from row 2. Resolve columns by header text, never by letter.

| Header | Type | Notes |
|---|---|---|
| `JO Number` | text | key |
| `BL/AWB` | text | |
| `Client` | text | |
| `Commodity` | text | |
| `Mode` | text | `Sea` or `Air` — drives the Unilab thresholds |
| `ETD` | date | |
| `ETA` | date | |
| `ATA` | date | starts every clock Penny cares about |
| `Status` | text | LogiSys milestone text |
| `Delivery Date` | date | **present = out of scope, hand to Nico** |
| `Account Handler` | text | |
| `Last Updated` | date | drives queue 5 staleness |
| `Source Report Date` | date | the LogiSys report this row came from |

### Also required: the `LogiSys Archive` sheet

Written append-only by the importer, one set of rows per report with its `Source Report Date`. **Queue 5b depends on it** — comparing today's ETA against the most recent previous report is the only way to detect a change.

Penny reads it, never writes to it. If the archive holds no prior report, queue 5b is skipped for that run.

### Secondary: the CA Tracker

Sheet `USE THIS FILE Philindo_CA_Tracker`, file ID `1YGG27KbsZUalEI-UekGk4nUnq3yttMM9w6kGo1-gSc8`.

Tab `CA Tracker`, header row 2, data from row 3. Penny reads two things only:

| Col | Header | Use |
|---|---|---|
| A | `Job Order Number` | join key |
| C | `Requested By` | handler, when `LogiSys Live` has none |
| Z | `Release Status` | cash advance funding state — **money leaving the company, not the shipment leaving the port** |
| AA | `Balance Remaining to Release` | shown when a CA is only partially released |

## 4. Data rules

1. **Freshness gate, before anything else.** If today's `Source Report Date` is not today, Penny sends nothing to anyone and writes a single notice to the COO: *"LogiSys feed for [date] has not arrived. No pending checks run today."* Running on stale data without saying so is the one unforgivable error.
2. **Delivery Date present → skip the row entirely.** Nico's territory.
3. **Validate every date.** Reject anything outside 2024-01-01 to 2027-12-31 and list it under queue 5 as a data defect. Never compute with a corrupt value. A year typed `0026` instead of `2026` once produced a 730,506-day gap in this company's data.
4. **Never infer an ATA.** A blank ATA with an arrival-sounding status is a queue 5 data gap, not an arrival.
5. **Flag prefixed duplicate JOs.** `IMP0826-1174` and `AIMP0826-1174` both exist in this company's records. Report the shipment once, flag the duplicate.
6. **Never use the mean.** Median and p75 only.
7. **Handler fallback:** `LogiSys Live.Account Handler` → CA Tracker `Requested By` → route to Ariel with the note "handler not set".

Handlers on record: **Kim Angelu Kong, Jena Lucido, Cherry Alarcon, Jimmy Rapera, Andrew Mausig, Jasmin Sawal.**

## 5. The five queues

All ages in **calendar days** — port charges and client lead times do not pause for weekends.

### Queue 1 — Arrived, not delivered

```
ATA present and valid
AND Delivery Date empty
```

Age = today − ATA.

**This is deliberately one queue, not two.** LogiSys milestones do not cleanly distinguish *released* from *in transit to the client* — the reliable milestone is `Delivered`. So do not attempt to infer a release step from status text. Measure the one thing the system reports honestly: arrived, and not yet delivered.

**This is the highest-value queue.** Two clocks run inside it, both from Philindo's real terms:

```javascript
const STORAGE_FREE_DAYS   = 5;   // port storage, MAXIMUM free period → charges from day 6
const DEMURRAGE_FREE_DAYS = 7;   // shipping line container, MINIMUM free → charges from day 8
```

Report both in the notice once the shipment passes day 2: days until storage charges begin, and days until demurrage begins.

### Queue 2 — In transit, ETA approaching

```
ATA empty
AND ETA within the next 3 days
```

Report the **cash advance funding state** from the CA Tracker (`Release Status`, column Z, plus `Balance Remaining to Release`, column AA).

> **`Release Status` is about money leaving the company, not about the shipment leaving the port.** Three states, because two is wrong:
>
> | Status | State | Treatment |
> |---|---|---|
> | Released / Fully Released | **funded** | fine |
> | Partially Released | **partial** | **Information, not an alarm.** Shipments can be and often are delivered on a partial release. Show the balance still to release. |
> | Not Released / Pending / blank | **unfunded** | the one worth flagging |
>
> **Red only when arriving within 1 day AND unfunded.** A partial release arriving tomorrow is amber, not red — treating it as an alarm would produce false urgency, which is exactly how an agent gets muted.
>
> Never match `released` as a substring: `"Not Released"` contains it and would report the opposite of the truth.

Written as **help, not warning**: *"Arriving Thursday — documents complete? CA not released."*

### Queue 3 — New job orders encoded

```
JO present in today's feed, absent from yesterday's
```

**COO only.** A plain list: JO, client, commodity, mode, ETA.

### Queue 4 — Stale status

```
Last Updated more than 7 days ago
OR ATA blank where Status implies arrival
OR any invalid date
```

**8 days, not 3.** Status genuinely does not change every few days on a shipment in transit, so a tighter threshold would flood Ariel with shipments that are fine. Stale means 8+ days with no movement.

**Ariel only.** Facts about shipments, never a completion rate.

### Queue 5 — ETA watch

Three separate checks. **Requires the `LogiSys Archive` sheet**, because 5b compares today's ETA against the most recent previous report.

**5a — No ETA recorded**
```
ETA blank AND ATA blank AND Delivery Date blank
```
Severity from ETD: green if ETD is blank or still in the future, amber if ETD passed 1–3 days ago, **red if ETD passed 4+ days ago**. A vessel that has sailed must have an ETA.
→ **Ariel.** His to encode. Written as a worklist, not a reprimand.

**5b — ETA changed**
```
today's ETA differs from the most recent previous report's ETA for the same JO
```
Report the old date, the new date, and the movement in days.
- moved ≤ 1 day → green, silent
- moved 2–4 days **later** → amber
- moved 5+ days later → **red**
- moved **2+ days earlier** → **red, regardless of size**
- ETA present before and blank now → **red**, reported as "ETA removed"

→ **Account handler.** Their plan just became wrong.

**5c — ETA passed with no arrival**
```
ETA is in the past AND ATA blank AND Delivery Date blank
```
Age = days past ETA. Amber at 1–2, **red at 3+**.
→ **Account handler**, Ariel copied at red — it is either a genuine delay or nobody updated the record, and both need a person.

**Earlier is worse than later.** A vessel arriving three days early is the most expensive event in this queue: trucking and cash advance were timed to a different date, and free time starts before anyone is ready. Two days earlier is red. Two days later is only amber. Do not treat the movement as an absolute value.

**Never estimate an ETA.** Not from ETD, not from typical transit time, not from a sister shipment on the same vessel. Blank is reported as blank.

**On the first ever run there is no prior report to compare.** Skip 5b entirely rather than reporting every shipment as changed.

## 6. Thresholds

| Queue | Green — silent | Amber — handler | Red — handler + COO | Critical |
|---|---|---|---|---|
| 1. Arrived → delivered | ≤ 1 day | 2–3 | **4+** | **6+** |
| 2. In transit | ETA 4+ days out | ETA ≤ 3 days | ETA ≤ 1 day and CA not released | — |
| 4. Stale status | ≤ 7 days | — | **8+** | — |
| 5a. No ETA | ETD blank or future | ETD passed 1–3 days | **ETD passed 4+ days** | — |
| 5b. ETA changed | ≤ 1 day | 2–4 days later | **5+ later, or 2+ EARLIER, or removed** | — |
| 5c. ETA passed, no ATA | — | 1–2 days | **3+ days** | — |

### Why queue 1 goes red on day 4

Not a preference — arithmetic from Philindo's actual terms.

| | Free period | First charge |
|---|---|---|
| Port storage | **5 days maximum** | **day 6** |
| Container demurrage | **7 days minimum** | **day 8** |

Storage is the tighter clock, so it sets the alarm. **Red on day 4 gives two days of warning before the first peso is charged. Critical on day 6 means storage is already running and demurrage is two days away.**

**Penny speaks before the meter starts, never after.** If a carrier's terms are tighter than 7 days, configure them and let the thresholds move — but red must always sit at least two days ahead of the earliest charge.

### Client lead-time overrides — these win over the general thresholds

```javascript
const CLIENT_SLA = {
  'UNILAB':  { Air: 3, Sea: 4 },   // air under 72 hours, sea under 4 days
  'DEFAULT': { Air: 4, Sea: 4 }
};
const UNILAB_PHARMA_SLA_WORKING_DAYS = 7;  // Indonesia pharma lane, ATA → delivery
```

Match client names case-insensitively and allow for `UNILAB INC.`, `UNILAB INC. ` and similar variants.

**Total ATA → delivered:** green ≤ 4 days, amber 5–7, red **8+** — unless a client override is tighter, in which case the override wins.

## 7. Output — Penny sends her own email

**Penny sends her own emails.** Nico is already built and sending his own, so she does the same rather than forcing a refactor of working code. The two agents are independent siblings: neither shares code, and a bug in one cannot make the other send something wrong.

### Recipients

```javascript
const RECIPIENTS = {
  coo:     'transport@philindo.com.ph',
  support: '',   // Ariel — FILL IN
  handlers: {
    'Kim Angelu Kong': '',
    'Jena Lucido':     '',
    'Cherry Alarcon':  '',
    'Jimmy Rapera':    '',
    'Andrew Mausig':   '',
    'Jasmin Sawal':    ''
  }
};
// Deliberately absent: Juan Carlos Uy (post-delivery, Nico's), the billing team,
// the CFO and the President. Do not add them.
```

**A blank address routes that person's section to the COO with a visible note.** Penny never drops a shipment because a contact is missing.

### Send time

```javascript
const SEND_HOUR = 7, SEND_MINUTE = 45;   // Penny 07:45, Nico 08:00
```

Penny goes first on purpose. A container flagged at 07:45 can still be moved today; a billing document can wait fifteen minutes.

### Subject lines

Always name-first, so a handler can tell a Penny email from a Nico email at a glance on a phone:

| Situation | Subject |
|---|---|
| Amber items only | `Penny: N shipments need action` |
| Any red item | `CRITICAL — Penny: N shipments need action` |
| Feed missing (COO only) | `Penny: LogiSys feed for [date] not received` |

### One email per person, per morning

All of that person's queues go in **one** message, sections ordered red before amber. Never two emails to the same person in one run.

| Recipient | Sections they receive |
|---|---|
| **Account handler** | Queue 1 (arrived, not delivered), queue 2 (arriving soon), 5b (ETA changed), 5c (ETA passed, no arrival) — their own shipments only |
| **Ariel** | Queue 4 (stale status), 5a (no ETA recorded) |
| **COO** | Everything: all five queues, the ATA-to-delivery median, the count of shipments inside and past free time, and the new-JO list |

### What each line must contain

JO number, client, stage, age in days. **For queue 1 only**, the days remaining until storage charges begin and until demurrage begins. Queues 2, 3, 4 and 5 carry no peso figure — nothing is being lost yet, and inventing urgency is how an agent gets muted.

### Silence is the reward

**A person with nothing amber or red receives no email at all.** Not an empty one, not an all-clear. Nothing. On a normal morning most handlers should hear nothing from Penny.

### Never contacted

Juan Carlos Uy, the billing team, the CFO, the President, and anyone outside Philindo.

## 7b. Queue 6 — the arrivals record and the monthly report

Penny also owns the arrivals picture, because she already holds the pre-delivery dataset.

**Every morning** she refreshes a sheet she creates and owns, `Penny Arrivals`:

- Year-to-date shipment count, split **Sea FCL / Sea LCL / Air**
- 20ft and 40ft container totals, and total packages
- Arrived, delivered, still pending
- **Median ATA to delivery** in days
- Monthly breakdown, January to date
- Breakdown by client, largest first

The Command Center's arrivals tab **reads** this sheet. Penny never edits the app.

**On the 7th of each month** she generates `Penny Monthly <Month Year>` as three tabs matching the existing register format exactly:

| Tab | Columns |
|---|---|
| SEA FCL | Shipment No, Shipper, Consignee, Loading Port, Discharge Port, ETA, ATA, Cargo Type, 20 Feet Containers, 40 Feet Containers, Place Of Delivery, Status |
| SEA LCL | + ETD, Total Packages, Unit |
| AIR | Shipment No, Shipment Date, Shipper, Consignee, Loading Port, Discharge Port, Airline, Total Packages, Unit, Place Of Delivery, ETD, ATD, ETA, ATA, Status |

Each carries the same three header lines the existing reports use: company name, register name, and `Date Range : From 01-Jan-YYYY To <last day of the reported month>`.

> **The write exception, stated precisely.** Penny writes to `Penny Arrivals` and `Penny Monthly …` only — sheets she creates. She never writes to the CA Tracker, the Billing Tracker, the Manifest Control, `LogiSys Live`, `LogiSys Archive`, or any Philindo web app. Acceptance test 7 audits this.

## 8. Technical requirements

- Google Apps Script
- Timezone **Asia/Manila**; `Utilities.formatDate`
- Time-driven trigger **07:45**, **skip Saturday and Sunday in code**
- Runs **after** the importer. Check the freshness gate first and abort cleanly if the feed is stale.
- Columns resolved by header text, never by letter
- `setup()` — installs the trigger and runs one immediate pass
- `dryRun()` — logs every queue and every email that would be sent, sends nothing
- **Fail loudly.** Missing sheet or missing required header → email the COO and stop. Never exit silently.
- `MailApp.sendEmail` with `htmlBody`. No images, no external CSS. Must render legibly on an iPhone at 390px.

## 9. Acceptance criteria

1. `dryRun()` produces five distinct queues. A JO may appear in at most one of queues 1–2, and at most one of 5a/5b/5c.
2. **No row with a Delivery Date appears anywhere** — verified by assertion, not by inspection.
3. A simulated stale feed (`Source Report Date` = yesterday) sends exactly one email, to the COO, and nothing to anyone else.
4. A Unilab air shipment at 73 hours from ATA is red. At 71 hours it is not.
5. **Queue 1 goes red on day 4 and critical on day 6** — strictly before `STORAGE_FREE_DAYS` (5) expires on day 6, and before `DEMURRAGE_FREE_DAYS` (7) expires on day 8. Verified by test at days 1, 3, 4, 6 and 8.
5b. **No release step is inferred from status text anywhere in the script.** Queue 1 keys only on ATA present and Delivery Date empty.
6. A handler with only green shipments receives **no email at all** — not an empty one.
7. A search of the whole script for `setValue`, `setValues`, `appendRow`, `clear`, `deleteRow` returns **zero matches**. Penny is read-only against every sheet including `LogiSys Live`.
7b. No person receives more than one email per run.
7c. Every subject line begins with `Penny:` or `CRITICAL — Penny:`.
8. No recipient list anywhere contains Juan Carlos Uy, the billing team, the CFO or the President.
9. A simulated Saturday and Sunday run sends nothing.
10. Invalid dates land in queue 4 and are never used in an age calculation.
10b. A shipment whose status has not moved for 7 days produces no stale notice; at 8 days it does.
11. **An ETA moved 2 days earlier is red. An ETA moved 2 days later is amber.** Asymmetry verified by test, not by reading the code.
12. An ETA that was present yesterday and is blank today is reported as "ETA removed", red.
13. With no prior report available, queue 5b produces zero notices rather than flagging every shipment as changed.
14. A blank ETA is never populated, estimated or inferred anywhere in the script.
15. A shipment with ETA blank, ETD blank and no arrival produces **no** notice — that is a normal pre-booking state.

## 10. Out of scope

- Anything after the delivery date — that is Nico
- Billing, liquidation, cash advances beyond reading `Release Status` and `Balance Remaining to Release` for queue 2
- Contacting clients, shipping lines or truckers
- Writing to any existing Philindo sheet
- Viber — email only, by the COO's decision

## 11. Open questions for the COO

1. Do free-time terms vary by carrier? The build uses storage 5 days / demurrage 7 days company-wide. If any carrier is tighter, name it and the thresholds move for that carrier only.
2. Should Ariel also receive queue 3 (new JOs encoded), since encoding is his work? Currently COO only.
3. Should Penny track detention separately once containers are returned empty, or is that out of scope for now?

## 12. Behaviour

**Read `penny_identity.md`, `penny_soul.md` and `penny_user.md` before writing any notice text.** Three points matter most:

- **Never cry wolf.** Green is silent. If everything is flagged, nothing is.
- **Report shipments, never people.** No rates, no rankings, no tallies of misses — particularly for Ariel, who is the best-performing structural change of the year, and for Cherry and Andrew, who both nearly resigned in July.
- **Speak while it is still cheap.** Penny's entire value is that she talks before the money is gone.
