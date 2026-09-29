# Agos: move sign-ups to the Agos Google account, and add an automatic welcome email

Paste this whole file into Claude Code, in the same project that set up the Agos website and Google Sheet.

## Why

Right now the sign-up Sheet and its Apps Script run under ops.philindo@gmail.com, so any email the script sends comes from that address. **The Philindo address must never appear to applicants.** So we move the Sheet and script to the Agos account (helloagos.ph@gmail.com). Then every email comes from helloagos, and the data sits in the Agos account.

## Part 1: new Sheet and script under helloagos.ph@gmail.com

1. Write the full `apps-script.gs` for me to paste. It keeps everything the current script does: the same columns, the Asia/Manila timestamp, the honeypot and 3-second spam check, and the notification email to helloagos.ph@gmail.com ("New Agos sign-up: ..."). Add a last column called "Welcome sent".
2. Give me simple click-by-click steps to follow while signed in as **helloagos.ph@gmail.com**:
   - create a Google Sheet named "Agos Sign-ups" with the header row
   - open Extensions > Apps Script, paste the script, and save
   - Deploy > New deployment > Web app, with Execute as: Me and Who has access: Anyone
   - approve the permissions, and copy the web app URL
3. When I give you the new web app URL, update the website's form endpoint to it and redeploy the site on Netlify (https://agosph.netlify.app). Change nothing else on the site.
4. Tell me how to switch off the old deployment in the ops.philindo account (Deploy > Manage deployments > Archive), so nothing is sent from or saved to that account anymore.

## Part 2: the automatic welcome email (in the new script)

1. After the row is saved and the notification is sent, email the applicant.
2. Send it **only** to the email address the person typed in the form, never to any other address. Skip it if the email isn't valid.
3. Skip test sign-ups, meaning any Name or Business that contains "TEST" (any case).
4. Use `MailApp.sendEmail` with:
   - `to`: the applicant's email
   - `name`: `Agos`
   - `replyTo`: `helloagos.ph@gmail.com`
   - `subject`: `Welcome to Agos, <first name>`
   - `body`: the plain-text version below
   - `htmlBody`: a simple HTML version of the same text, with a white background, system font at 16px, max-width 560px, and a clickable website link. Escape every form value before putting it in the HTML.
5. Safety check: before sending, confirm `Session.getEffectiveUser().getEmail()` is `helloagos.ph@gmail.com`. If it isn't, do not send, and write `Not sent (wrong account)`. The Philindo address must never be used.
6. First name is the first word of the Name field. Business is the Business field.
7. Wrap the email in try/catch so a failed email never stops the row from saving or the notification from sending. Write `Yes`, `No (test)`, `Failed` or `Not sent (wrong account)` in "Welcome sent".

## Part 3: test

Submit one sign-up on https://agosph.netlify.app with my own email and a normal business name. Check that:

- the row appears in the new Sheet
- the notification arrives at helloagos
- the welcome email arrives **from helloagos.ph@gmail.com, showing the name "Agos"**, and looks right on a phone

Then delete that test row.

## The welcome email (plain-text version)

Subject: Welcome to Agos, {FirstName}

```
Hi {FirstName},

Thanks for signing up {Business} to Agos. We've received your details.

Here's what happens next:
1. We review your details.
2. When there's a lender that fits your business, the Agos team will reach out to you first. We never share your information with a lender without your approval.

You don't need to send any documents yet. If you'd like to get ready, lenders usually ask for your SEC or DTI registration, mayor's permit, BIR-stamped ITR, 6 months of bank statements, and a valid ID.

Agos is free for businesses. We will never ask you for payment. If anyone asks you to pay to "get approved" in the name of Agos, please tell us.

Need to update your details or have a question? Just reply to this email.

Salamat,
The Agos Team
helloagos.ph@gmail.com
https://agosph.netlify.app

Agos is not a lender. We help logistics businesses connect with SEC-registered financing and lending companies. The lender makes the final decision.
```
