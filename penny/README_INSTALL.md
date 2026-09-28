# Penny — installation

Six Apps Script files. Tested: **27 assertions passing**, including the free-time ladder,
the earlier-vs-later ETA asymmetry, the 8-day staleness rule, and a write-verb audit.

## Install

1. Open the Google Sheet that will hold **LogiSys Live** (the one the importer will write to).
   **Extensions → Apps Script.**
2. Create six files and paste in the contents of each:
   `Config.gs` · `Lib.gs` · `Queues.gs` · `Arrivals.gs` · `Email.gs` · `Main.gs`
3. In `Config.gs`, fill in `RECIPIENTS.support` (Ariel) and the six handler addresses.
   A blank address routes that person's section to the COO with a visible note — nothing is dropped.
4. Run **`bootstrapFeedSheets()`** once. It creates `LogiSys Live` and `LogiSys Archive`
   with the correct headers so you can test before the importer exists.
   It never overwrites a sheet that already has data.
5. Run **`dryRun()`**. Check the execution log: it prints every queue and every email
   it *would* send, and sends nothing.
6. When the log looks right, run **`setup()`**. Installs the 07:45 Asia/Manila trigger
   (Monday–Friday) and does one live run.

## The functions

| Function | What it does |
|---|---|
| `setup()` | Installs the 07:45 trigger, then runs once |
| `dryRun()` | Logs everything, sends nothing, writes nothing |
| `runPenny()` | The real run |
| `bootstrapFeedSheets()` | Creates LogiSys Live + Archive with correct headers |

## Shadow mode — do this first

Before Ariel or any handler receives anything, set **every** address in `RECIPIENTS`
to your own, and run for five working days. You will receive each person's email exactly
as they would. Check three things: the JOs are right, nothing already resolved appears,
and the wording reads the way you would say it. Then switch the real addresses on.

## What Penny writes

Only two sheets, both of which she creates:

- `Penny Arrivals` — refreshed every morning
- `Penny Monthly <Month Year>` — three register tabs, generated on the 7th

She never writes to the CA Tracker, the Billing Tracker, the Manifest Control,
`LogiSys Live`, `LogiSys Archive`, or any Philindo web app. The test suite audits this.

## Free time

```
STORAGE_FREE_DAYS   = 5   // port storage max free  -> charges from day 6
DEMURRAGE_FREE_DAYS = 7   // line container min free -> charges from day 8
```

Queue 1 goes **red on day 4** (two days before the first charge) and
**critical on day 6** (storage running, demurrage two days out).
If a carrier is tighter than 7 days, change the constant and every threshold moves with it.

## Running the tests

`penny_tests.js` runs the whole logic under Node with the Apps Script services stubbed:

```
node penny_tests.js
```

It is not needed in production — it is there so any change can be re-verified before it goes live.
