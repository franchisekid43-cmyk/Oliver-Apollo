# Philindo Operations — how each team works in the system

*1 October 2026. From the switch-over (Admin → Switch-over) the CA Tracker app and the Manifest Control app are no
longer used: everything below is done in Philindo Operations. Sign in with your work email and password.*

## Account handlers (role: Operations) — cash advances

Menu: **Finance → Cash advances**. "My cash advances" lists yours.

**Ask for a cash advance**
1. **New CA request**.
2. Type the job order number. If the job is in the system, the client, terms and ETA fill in by themselves.
   If the job order already has a cash advance, this becomes a **supplemental** request on top of it.
3. Choose the priority (Super Urgent or Not Urgent) and type the estimated charges. The total adds itself up.
4. **Add files** for the supporting invoices (PDF or photos, up to 20 MB each), then **Send request**.
5. Finance sees it at once. You see its status on the job order's page: *Waiting for Finance → Approved → Released*.

**Liquidate**
1. Open the job order (Cash advances → the job order).
2. **Set delivery date** if it is not there. The liquidation is due **7 days after delivery**; after that it shows as
   *Liquidation overdue*.
3. **Liquidate** → type what was spent, item by item (processing fee items and receipted expenses; **Add another charge**
   for anything else), attach the **receipts** and the **acknowledgement / petty cash voucher**, say whether the
   receipts are complete, then **Submit liquidation**.
4. The form shows the difference as you type: *balanced*, *excess to return to the company*, or *short — to recover
   from the client's billing*. The accountant is emailed with your receipts.
5. If Finance **returns it for correction**, you see why on the job order's page — **Liquidate again**.

**Use the excess on another job order (offset)**
On the job order's page, **Offset excess** (or Cash advances → **Offset request**): the other job order, the amount,
the reason → **Ask to offset**. It counts only once Finance approves it.

## Finance (role: Finance)

Menu: **Finance → Cash advances** (you land here after signing in). The **Finance queue** at the top has everything
waiting for you:
- **Requests to approve** → **Decide**: approve the full amount, or type less to approve part of it, or **Reject**
  (say why).
- **Approved, to release** → **Release**: the amount (part is fine), date and time, how (Cash, Bank Transfer, Check,
  GCash) and the reference number.
- **Liquidations to verify** → **Check**: compare with the receipts (open them on the job order's page), then
  **Verified** — or **Return for correction** with what to fix.
- **Offsets to decide** → **Decide**: shows how much cash the job order really has on hand → **Approve** or **Reject**.

Also: **Container deposits** (deposits not refunded after 30 days show as *Overdue — follow up*; **Update** when
refunded or collected); on a job order's page, **Close (billed to client)** with the invoice number, or **Cancel this cash advance** (only
before any cash is released). Every request and liquidation has a **PDF** button for the paper file, with signature
lines.

## Billing team (role: Billing & CA)

Menu: **Finance → Billing updates**, or **Finance → Billing** where each unbilled job order has a **Billing update**
button.
1. **New billing update** → type the job order number. The form starts from the last update for that job order
   (consignee, delivery date, documents), so only change what is new.
2. Tick the documents in hand (DR, original receipts, shipping line, port, warehouse receipts). Any missing →
   *Cannot bill yet*. Approved by / approval date when approved.
3. Status: *Waiting DR*, *For Billing*, *Forwarded to Finance Billing* or *Billed*. **Billed = forwarded to
   Finance Billing**: it needs the **confirmed amount** and the **forward date** (that is the billing date).
4. **Save billing update**. Every update is kept; the newest one counts. The list shows the days from delivery to
   handover: same day, on track (1–4), at risk (5–8), delayed (9+).

## Manifest team (role: Manifest; Documentation can too)

Menu: **Shipments → Manifest**.
1. **+ Log a shipment**: mode, consignee and ETA date are needed even for a draft; add the house bill(s) (several:
   separate with commas), MBL, flight/vessel, port, and the **tagging date and time**.
2. The form shows the deadline: **sea 24 hours, air 6 hours before tagging** (without a tagging date yet: the end of
   the arrival date). Save it as a **Draft** if details are missing — it is on the board and alerts are armed.
3. If a house bill is already logged, it says which entry; tick **Log anyway** only for a split shipment.
4. Click an entry on the board to change anything. When lodged: status **Manifested**, the **registry number**,
   tick **Encoded in CDEC** → **Save changes**. Changing the tagging time moves the deadline and the alerts start again.
5. Alerts: an email at 12 hours and 3 hours before each deadline, and every morning for anything due or late — to
   you and the addresses on the entry; the supervisor on the last calls and anything late; escalation when late.

## Everyone

- Management sees every page and changes nothing.
- Every change is recorded with who made it and when (Admin → Change log).
- The CA Tracker and Manifest Control sheets are no longer updated after the switch-over — do not type into them.
