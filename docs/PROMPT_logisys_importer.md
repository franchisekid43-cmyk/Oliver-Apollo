# Master Prompt — The LogiSys Importer

One piece of plumbing. It has no name, no personality and no opinion — it moves data and nothing else. **Build this before Penny.** Nico is already built and does not depend on it.

> **The shared outbox originally specced here has been dropped by the COO's decision.** Nico is already built and sends his own email; Penny will do the same. Two independent senders, no shared code, no refactor of working code. Part B is retained below only as a record of the design that was considered and rejected — **do not build it.**

---

## Why these are not agents

| | Plumbing (this file) | An agent (Nico, Penny) |
|---|---|---|
| Makes a judgment? | No | Yes |
| Emails staff? | Never | That is the point |
| Needs an identity file? | No | Yes |
| If it breaks | A dashboard goes stale | Wrong emails reach the team |

Keeping the pipe separate from the agents is what stops a date-parsing bug from making Penny send a wrong email to a handler. Her credibility is the whole asset; a pipe must not be able to spend it.

---

# PART A — The LogiSys Importer

## A1. What it does

LogiSys is configured to email a daily shipment report to a dedicated address. The importer reads that email, parses the attachment, and writes the rows to a single sheet called **`LogiSys Live`**.

```
LogiSys ──daily email──▶ Importer ──writes──▶ LogiSys Live ──┬──▶ Penny
                                                              ├──▶ Nico
                                                              └──▶ Command Center
```

## A2. Hard constraint

> **The importer writes to exactly one sheet — `LogiSys Live`, which it creates and owns. It must never write to, edit or delete anything in the CA Tracker, the Billing Tracker, the Manifest Control, or any other existing Philindo sheet or web app.**

This preserves the COO's original instruction that nothing built here edits existing data. The importer only adds a new sheet of its own.

## A3. Input

- **Inbox:** a dedicated address, e.g. `logisys-reports@philindo.com.ph` — confirm with the COO
- **Sender / subject:** match on the LogiSys sender address and a subject pattern, not on position in the inbox
- **Attachment:** Excel or CSV as LogiSys sends it
- **Schedule:** daily. LogiSys can send more often if wanted; the importer should handle multiple reports a day by keeping the latest per JO.

## A4. Output — the `LogiSys Live` contract

Header row 1, data from row 2. **This schema is a contract — Penny, Nico and the Command Center all depend on these exact header strings.**

| Header | Type | Notes |
|---|---|---|
| `JO Number` | text | key. One row per JO — latest wins |
| `BL/AWB` | text | |
| `Shipper` | text | needed for the arrivals report |
| `Client` | text | consignee, as LogiSys spells it |
| `Commodity` | text | |
| `Mode` | text | normalise to exactly `Sea` or `Air` |
| `Cargo Type` | text | `FCL`, `LCL` or blank for air |
| `Loading Port` | text | |
| `Discharge Port` | text | |
| `Place Of Delivery` | text | |
| `Shipment Date` | date | air register |
| `ETD` | date | |
| `ATD` | date | air register |
| `ETA` | date | |
| `ATA` | date | blank if not arrived. **Never inferred.** |
| `Delivery Date` | date | blank if not delivered |
| `Containers 20ft` | number | sea FCL |
| `Containers 40ft` | number | sea FCL |
| `Total Packages` | number | sea LCL and air |
| `Unit` | text | PLT, PKG, DRM, BOX, CSE, CAN |
| `Airline` | text | air only |
| `Status` | text | LogiSys milestone text, unmodified |
| `Account Handler` | text | blank if LogiSys does not carry it |
| `Last Updated` | date | from LogiSys if available, else the report date |
| `Source Report Date` | date | the date of the report this row came from |

**Why the schema grew.** The first version carried only what the daily pending checks need. Penny also maintains the year-to-date arrivals record and generates the monthly arrivals report on the 7th, matching the existing three-register format (Sea FCL, Sea LCL, Air). That needs shipper, ports, cargo type, container counts, packages, unit and airline. **Configure the LogiSys report with all of the above** — or send three daily reports (Sea FCL, Sea LCL, Air) to the same address, which matches how they are already filed. The importer handles either.

## A5. Rules

1. **Replace, do not append.** One row per JO. A JO in today's report overwrites yesterday's row. The sheet is a current-state mirror, not a log.
2. **Keep a `LogiSys Archive` sheet** appending every report's rows with the report date. Append-only, never edited. **This is not optional and it is not only for trends — Penny's queue 6b (ETA changed) cannot work without it**, because detecting a moved ETA requires yesterday's value. Same headers as `LogiSys Live`.
3. **Normalise dates to real date values**, not strings. Reject anything outside 2024-01-01 to 2027-12-31, write the row with that field blank, and list it in the run report.
4. **Normalise `Mode`** to `Sea` or `Air`. Anything else goes through as-is and is flagged.
5. **Never infer.** A blank field stays blank. No deriving ATA from ETA, no guessing mode from commodity.
6. **Write `Source Report Date` on every row.** Penny's freshness gate depends on it.
7. **Idempotent.** Running twice on the same email must produce the same sheet, not doubled rows.
8. **Mark the email processed** with a Gmail label after a successful run, so it is not re-imported.

## A6. Failure behaviour

| Situation | What it does |
|---|---|
| No email today | Writes nothing. Emails the COO once: *"LogiSys report for [date] not received."* Does not retry silently. |
| Attachment unreadable | Writes nothing. Emails the COO with the error. **Never partially overwrites `LogiSys Live`.** |
| Required header missing | Writes nothing. Emails the COO naming the missing header. |
| Some rows bad, most fine | Writes the good rows, lists the bad ones in the run report to the COO. |

**Never leave `LogiSys Live` half-written.** Build the new content in memory, validate it, then write it in one operation. A partial mirror is worse than a stale one, because Penny's freshness gate cannot detect it.

## A7. Technical

- Google Apps Script, Gmail + Sheets services
- Timezone **Asia/Manila**
- Trigger: hourly, processing any unprocessed matching email. Not tied to 08:00 — it must have run before Penny does.
- `setup()` installs the trigger and processes the most recent matching email
- `dryRun()` parses and logs without writing
- Fail loudly to the COO, never silently

## A8. Acceptance criteria

1. `dryRun()` on a real LogiSys email prints every row with correctly typed dates.
2. Running twice on the same email produces an identical `LogiSys Live` — no duplicate rows.
3. A corrupt date lands as a blank field plus a line in the run report, never as a computed value.
4. A missing attachment leaves `LogiSys Live` completely untouched.
5. Every row carries `Source Report Date`.
6. A search for writes against any sheet other than `LogiSys Live` and `LogiSys Archive` returns zero matches.

---

# PART B — The Shared Outbox — NOT BUILT

> **Skip this section.** The COO decided each agent sends its own email. Nico already does; Penny does the same. Kept only as a record of the rejected design.

## B1. The problem it solves

Penny and Nico both run every working morning and both would email the same handlers. **Two emails a day from two robots is how a team learns to ignore both.** The outbox gives each person exactly one email.

## B2. How it works

Neither agent sends email. Each writes rows to a **`Daily Notices`** sheet. A small sender then composes one email per recipient.

```
Penny ──┐
       ├──▶ Daily Notices ──▶ Sender ──▶ ONE email per person
Nico ──┘
```

## B3. `Daily Notices` schema

Header row 1, data from row 2. Cleared at the start of each day's run.

| Header | Notes |
|---|---|
| `Run Date` | |
| `Recipient Name` | e.g. `Kim Angelu Kong`, `Ariel`, `Juan Carlos Uy`, `COO` |
| `Agent` | `Penny` or `Nico` |
| `Section` | the heading this item appears under, e.g. `Arrived, not released` |
| `Severity` | `amber` or `red` |
| `JO Number` | |
| `Client` | |
| `Detail` | the one line the person reads |
| `Days` | age |
| `Amount` | peso figure, or blank where none applies |
| `Notice Count` | how many times this JO has been notified |

## B4. The sender

1. Runs at 08:00 Asia/Manila, Monday to Friday, **after both agents have written**
2. Groups notices by `Recipient Name`
3. Composes one email per person, with Penny's items and Nico's under separate headings, red before amber
4. **Sends nothing to a person with zero notices.** Silence is the reward.
5. Subject: `Philindo daily — N items` and for red items `CRITICAL — Philindo daily — N items`
6. Tracks `Notice Count` per JO in `PropertiesService` so subjects can read "3rd notice". **The number climbs; the tone never changes.**
7. Escalation stops at the COO. The CFO and the President are never recipients.

### Recipient addresses

The COO has supplied the eight addresses to the Nico build. Use the same configuration object; add Ariel if he is not already in it.

```javascript
const RECIPIENTS = {
  coo:            'transport@philindo.com.ph',
  transportHead:  '',   // Juan Carlos Uy
  billingTeam:    '',
  support:        '',   // Ariel
  handlers: { /* the six handlers */ }
};
// Deliberately absent: CFO and President. Do not add them.
```

**A blank address routes that person's section to the COO with a visible note. Never drop a notice because a contact is missing.**

## B5. Acceptance criteria

1. A person with items from both agents receives exactly **one** email containing both sections.
2. A person with zero notices receives nothing.
3. No email contains another person's shipments.
4. Red items appear above amber within each section.
5. `Notice Count` increments per JO per day and resets when the JO clears.
6. No recipient list contains the CFO or the President.
7. A simulated Saturday or Sunday run sends nothing.
8. Renders legibly on an iPhone at 390px.

---

## Build order

| Order | What | Status |
|---|---|---|
| 1 | **Nico** | **Built.** Sends his own email at 08:00. Do not modify him. |
| 2 | **LogiSys daily report email** | Waiting on the COO to turn it on and confirm the address |
| 3 | **Importer** (Part A) | Blocked by step 2 |
| 4 | **Penny** | Blocked by step 3. Sends her own email at 07:45. |

**The shared outbox is not being built.** Each agent sends its own email. Penny at 07:45, Nico at 08:00, subjects name-first so a handler can tell them apart on a phone.
