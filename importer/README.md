# LogiSys importer — installation

Plumbing, not an agent. It reads the daily LogiSys register emails (SEA and AIR), parses the
attachments and writes **exactly two sheets, both its own**: `LogiSys Live` and `LogiSys Archive`.
Penny, Nico and the Command Center read them. It emails nobody but the COO, and only when
something went wrong. Tested: **48 checks passing** (`node importer_tests.js`).

Spec: `docs/PROMPT_logisys_importer.md` (Part A. Part B, the shared outbox, is not built).

## Install

It is a **separate Apps Script project** from Penny, so a parsing bug can never make Penny send
a wrong email.

LogiSys emails the report to **franchisekid43@gmail.com every day at 06:00**. Apps Script reads
the Gmail of the account that owns the project, so:

1. Sign in to Google as **franchisekid43@gmail.com**, open <https://script.google.com> →
   **New project**, name it *LogiSys Importer*. That account must be able to edit the feed
   workbook — share it with franchisekid43@gmail.com if it lives on a Philindo account.
   If the importer ever runs as another account, it stops and tells the COO.
2. Create `Config.gs` and `Importer.gs` and paste in their contents. In **Project Settings**, tick
   *Show "appsscript.json"* and paste `appsscript.json` (Asia/Manila time zone; it enables the
   **Drive advanced service**, used to convert Excel attachments).
3. In `Config.gs`:
   - `FEED_SPREADSHEET_ID` — already set to *Philindo Shipments Feed*, owned by ops.philindo@gmail.com and shared with franchisekid43@gmail.com as editor.
   - `FEED_SUBJECTS` — confirm against the first real LogiSys email.
   - `FEED_SENDER` is `no-reply@philindo.com.ph`, LogiSys's sending address. Only emails from it
     with a matching subject are imported.
4. Run **`dryRun()`**. The log prints every row it parsed, with typed dates, and every problem.
   It writes nothing and emails nobody.
5. Run **`setup()`**. Installs a trigger every 15 minutes and imports whatever is waiting. The
   06:00 report is in LogiSys Live by about 06:15, well before Penny runs at 07:45.

| Function | What it does |
|---|---|
| `setup()` | Installs the trigger, then runs once |
| `dryRun()` | Parses and logs, writes nothing, sends nothing |
| `runImporter()` | The real run |

## What it writes

**`LogiSys Live`** — one row per JO, the 32 headers in `FEED_HEADERS` (identical to Penny's;
the test suite checks it). Built entirely in memory, validated, then written in one operation.
An older report never overwrites a newer one. If a sheet called `LogiSys Live` exists without
these headers, the importer refuses to touch it.

Three columns are the importer's, not LogiSys's:

| Column | Meaning |
|---|---|
| `Mode` | `Sea` or `Air`, from which register the row came from — never from the goods |
| `Last Updated` | the report date on which the Status last changed (drives Penny's 8-day stale check) |
| `Delivered` | the report date on which the JO was **first** reported with a delivered status — LogiSys carries no delivery date, so this is the earliest date the feed can evidence |
| `Source Report Date` | the date of the email the row came from (Penny's freshness gate) |

**`LogiSys Archive`** — append-only, never edited. A row is appended whenever a JO is new or any
field changed. Penny reads a JO's latest archived state before today as "the previous report".

## Where this differs from the spec, and why

| Spec | Built | Why |
|---|---|---|
| Archive appends every report's rows | Archive appends new or changed rows | The LogiSys register is year-to-date (~1,300 rows × 32 columns). Appending all of it daily hits Google Sheets' 10-million-cell limit in about eight months. A change log carries the same information. |
| Mark processed with a Gmail label | Tracked by message ID; the label is still applied | Gmail threads daily emails with the same subject. A label on the thread would hide every later report in it. |
| Hourly trigger | Every 15 minutes | Hourly cannot guarantee the morning report is in before Penny runs at 07:45. |

## Rules it keeps

- **Never infers.** A blank ATA stays blank. A date outside 2024-01-01 … 2027-12-31, or text that
  is not `yyyy-mm-dd` / `dd-MMM-yyyy`, is written blank and listed in the run report
  (`03/04/2026` is ambiguous and is reported, not guessed).
- **Idempotent.** Re-importing the same email leaves both sheets byte-for-byte the same.
- **Never half-writes.** A report with no attachment, an unreadable attachment or a missing
  required header (`Shipment No`, `Consignee`, `ETD`, `ETA`, `ATA`, `Status`) is rejected
  whole, labelled `LogiSys/Failed`, and the COO is told why.
- **No report by 07:30** on a working day → the COO gets *"LogiSys report for [date] not
  received."* once.

## Running the tests

```
node importer_tests.js
```
