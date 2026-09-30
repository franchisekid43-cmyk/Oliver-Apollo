# Agos website: go-live brief for Claude Code

Paste this whole brief into Claude Code, and attach `agos.html` (the finished landing page).

## Goal

Put the Agos landing page live on the internet for free, and make the sign-up form actually save each sign-up to a Google Sheet and email a notification to helloagos.ph@gmail.com. Keep the design exactly as it is.

**Agos Verified first.** A customer must be Agos Verified before we forward their requirements to any lender. Agos Verified means we have checked the business and every document in its file (registration, permits, tax returns, bank statements, owner's ID) is complete, current and consistent. Nothing goes to a lender before that, and then only with the customer's approval.

## What already exists

- `agos.html`: the complete page (HTML, CSS and JavaScript in one file). The form already validates every field and shows a thank-you message, but it does not save anything yet.
- Brand: Agos, tagline "Keep your business flowing." Contact: helloagos.ph@gmail.com.

## Tasks

1. **Project setup**
   - Create a folder `agos-site` with `index.html` made from `agos.html`. Keep one self-contained HTML file; no framework is needed.
   - Add a real `<head>` with charset, viewport, title "Agos", a meta description ("Business financing help for customs brokers, freight forwarders and truckers in the Philippines."), Open Graph tags (title, description), and a favicon made from the Agos logo mark (the blue rounded tile with white waves and coin, already in the page as an inline SVG symbol).

2. **Save sign-ups to Google Sheets (free, no server)**
   - Write a Google Apps Script (`apps-script.gs`) for a Google Sheet named "Agos Sign-ups" with columns: Timestamp (Asia/Manila), Name, Business, Type, Location, Years, Monthly billings, Amount needed, How soon, Mobile, Email, Consent, Source page.
   - `doPost(e)` appends one row and emails a short notification to helloagos.ph@gmail.com ("New Agos sign-up: <Business>, <Type>, <Location>, <Amount>").
   - Reject requests that fail basic checks (missing required fields, consent not ticked, honeypot filled).
   - Walk me step by step through creating the Sheet, pasting the script, and deploying it as a Web App (Execute as: me; Who has access: Anyone). Then put the Web App URL into the page as a single config constant.
   - In the page, on a valid submit, POST the form data to that URL. Use a `text/plain` body with JSON inside, to avoid CORS preflight problems with Apps Script. Show a sending state on the button, keep the existing thank-you screen on success, and show a friendly inline error with the contact email if saving fails. Never lose what the person typed on an error.

3. **Agos Verified**
   - The page says it plainly: only Agos Verified files go to lenders (the example file, the three steps, the thank-you message, and a FAQ entry "What does Agos Verified mean?", which also says it is not a loan approval).
   - The Sheet enforces it: every sign-up arrives with "Agos Verified" unticked, and the Sheet refuses a "Forwarded to lenders" tick on any row that is not Agos Verified.
   - The notification email says each new sign-up is not yet Agos Verified.

4. **Spam protection**
   - Add a hidden honeypot field, and reject submissions sent less than 3 seconds after the page loads.
   - Keep it invisible to real users. No CAPTCHA for now.

5. **Tracking (optional, placeholder)**
   - Add a clearly marked placeholder for the Meta Pixel (`PIXEL_ID`) that fires `PageView` on load and `Lead` on successful sign-up. Leave it switched off until I provide the ID.

6. **Deploy for free**
   - Deploy to Vercel's free plan (or Netlify if easier), with a URL like `agos.vercel.app` or the closest available name.
   - Guide me through any sign-in steps. I will do the logins myself.
   - Add simple instructions in a `README.md` for redeploying after edits, and for adding a custom domain later (for example getagos.ph).

7. **Test before calling it done**
   - Submit a test sign-up on the live URL and confirm the row appears in the Sheet and the notification email arrives.
   - Check the page on a phone-width screen and in dark mode.
   - Confirm there are no console errors.

## Rules

- Do not change the design, colors, animations or wording, except where these tasks require it.
- Do not add paid services.
- Do not collect any documents or files. The form only collects the fields listed above.
- Keep the privacy notice and the consent checkbox exactly as they are.
- Never commit secrets. The Apps Script URL is fine to include in the page.
