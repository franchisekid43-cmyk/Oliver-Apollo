# Prompt — Connect Penny to the Command Center

Paste this into the Claude Code session that owns the `philindo-command-center` repo.

---

## Context

Two systems need to share one source of truth.

- **The Command Center** (this repo, deployed at `philindo-command-center.vercel.app`) is where the COO reads the pending board daily.
- **Penny** is a Google Apps Script agent that runs every working morning at 07:45 Asia/Manila. She reads the LogiSys daily email feed, ages every pending shipment, emails the account handlers and Ariel, maintains a year-to-date arrivals record, and generates the monthly arrivals report on the 7th.

They must not become two versions of the truth. That failure already cost real money: on 28 September 2026, LogiSys reported a container as 22 days at port while the maintained tracker correctly showed it had not arrived. Across 87 job orders present in both, **arrival dates disagreed on 33 — always in the same direction**, because LogiSys writes its ETA into the ATA field.

## The task

**Step 1 — Report what this app uses for storage.**

Before changing anything, state plainly:

- What backs the data: Postgres, Supabase, Vercel KV, Vercel Blob, Google Sheets, static JSON in the repo, or something else
- Where the pending shipments are read from and written to (file paths)
- How Ariel's uploads enter the system today
- Whether the app can read a Google Sheet (does it already have `googleapis` or a service account?)

**Step 2 — Then implement one of these, and say which you chose and why.**

### Option A — Google Sheet as the shared store *(preferred unless there is a good reason not to)*

The app reads two sheets that Penny writes and owns:

| Sheet | Contents |
|---|---|
| `LogiSys Live` | One row per job order, current state, written by the importer |
| `Penny Arrivals` | Year-to-date totals by mode, container counts, monthly breakdown, by-client breakdown, median ATA-to-delivery |

Why this is preferred: Penny is already an Apps Script with native Sheets access, the CA Tracker is already a Google Sheet, and the operations team already works in Sheets. No new infrastructure, no credentials to rotate, and Ariel can see and correct the data directly.

Implement a read-only Sheets client with a service account, cache for 5 minutes, and fall back to the existing store if the sheet is unreachable — the dashboard must never show a blank page because a sheet call failed.

### Option B — The app exposes an API that Penny writes to

Only if the app already has a real database and moving to Sheets would be a downgrade.

- `POST /api/ingest/shipments` — upsert by job order number
- `POST /api/ingest/arrivals` — replace the arrivals summary
- Bearer token in an environment variable, and the route must reject anything else
- Idempotent: posting the same payload twice changes nothing

Then tell me the endpoint and how to set the token, and I will add `UrlFetchApp` calls to Penny.

## Rules that must hold either way

1. **One store, many readers.** Whatever is chosen, the Command Center and Penny read the same data. No copies.
2. **Penny never writes to the CA Tracker, the Billing Tracker or the Manifest Control.** She writes only to sheets she creates.
3. **Arrival is not taken from the LogiSys ATA field while Ariel still maintains the tracker separately.** Priority order: the maintained tracker, then status milestones that only occur after arrival (`Container Discharged`, `DO Issued`, `Gatepass Released`, `Payment of Duties and Taxes`, `Final Assesment`), then the LogiSys ATA — and only when it differs from that row's own ETA.
4. **This reverses with one config flag** once Ariel updates LogiSys directly instead of uploading to the Command Center. Build it as a single switch, not scattered conditionals.
5. **Delivered shipments leave Penny's scope** and belong to Nico, the billing agent. The boundary is the delivery date.

## Reference data, measured 28 September 2026

| | |
|---|---|
| Shipments year to date (both registers) | 1,296 — 938 Sea FCL, 138 Sea LCL, 220 Air |
| Containers | 525 × 20ft, 1,072 × 40ft |
| Pending, September onward | 64 |
| Arrived and not delivered, per LogiSys | 12 — but only 1 has a trustworthy arrival date |
| Arrival disagreements, tracker vs LogiSys | 33 of 87, all one direction |
| Port storage free time | 5 days — charges from day 6 |
| Container demurrage free time | 7 days — charges from day 8 |

Penny goes amber at 2 days from arrival, **red at day 4** (two days before storage charges begin) and **critical at day 6**.
