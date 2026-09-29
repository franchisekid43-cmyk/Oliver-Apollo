# Agos website

The Agos landing page, and the Google Sheet that catches its sign-ups. Everything here is free.

```
agos-site/
  public/index.html   the whole website (one file). This is what goes live.
  apps-script.gs      the Google Apps Script that saves each sign-up to the Sheet and emails you
  agos_tests.js       tests for the script:  node agos-site/agos_tests.js
  netlify.toml        tells Netlify to publish only public/
  vercel.json         the same for Vercel
  BRIEF.md            the go-live brief, with the Agos Verified goal
```

**Agos Verified first.** A customer must be Agos Verified before we forward their requirements to any
lender. The page tells customers this, the notification email says every new sign-up is not yet
verified, and the Sheet refuses a "Forwarded to lenders" tick on a row that is not Agos Verified
([how the team uses it](#agos-verified-in-the-sheet)).

**Live now:** the site is at [agosph.netlify.app](https://agosph.netlify.app). It was deployed with Netlify
Drop and is not linked to GitHub, so to publish a change, drop `public/index.html` on the project's page
in Netlify. The "Agos Sign-ups" Sheet and its script live in the **ops.philindo@gmail.com** Drive, and the
script is deployed from that account, so notification emails come from it. `SIGNUP_URL` in the page
points at that deployment.

Go live in three steps: **1** the Sheet, **2** the website, **3** a test sign-up.

---

## Step 1: the Sheet and its Apps Script (about 10 minutes)

Do this signed in to Google as **helloagos.ph@gmail.com**, so the Sheet belongs to Agos and every email
comes from that account. The script refuses to send the applicant welcome email from any other account.
Use an **Incognito window signed in only as helloagos**: with several Google accounts signed in, Apps
Script can open under the wrong one or fail to open.

1. Go to [sheets.new](https://sheets.new). A blank spreadsheet opens.
2. Click **Untitled spreadsheet** (top left) and rename it **Agos Sign-ups**.
3. Menu **Extensions → Apps Script**. A code editor opens in a new tab.
4. Delete the few lines already there. Open `apps-script.gs` from this folder, copy all of it, paste it in.
5. Click **Untitled project** at the top and rename it **Agos Sign-ups**. Press **Ctrl+S** (Mac: **Cmd+S**) to save.
6. In the toolbar, pick **setup** from the function drop-down, then click **Run**.
   - Google asks for permission: **Review permissions** → choose helloagos.ph@gmail.com.
   - "Google hasn't verified this app" is normal for your own script: click **Advanced** →
     **Go to Agos Sign-ups (unsafe)** → **Allow**.
   - Back in the Sheet, a **Sign-ups** tab now has the column headers.
7. Optional check: pick **testSignup** in the drop-down and click **Run**. A TEST row appears in the Sheet
   and a "New Agos sign-up" email arrives at helloagos.ph@gmail.com. Delete that row afterwards.
8. Click **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Description: `Agos sign-up form`
   - Execute as: **Me (helloagos.ph@gmail.com)**
   - Who has access: **Anyone** (not "Anyone with Google account": website visitors are not signed in)
   - Click **Deploy**, and **Authorize access** again if asked.
9. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.
   Paste it in your browser: you should see `{"ok":true,"service":"agos-signups"}`.
10. Open `public/index.html`, find this line near the bottom (search for `AGOS CONFIG`):
    ```js
    var SIGNUP_URL = '';
    ```
    and put your URL between the quotes. Save. (Or send the URL to Claude and it will do it.)

Until `SIGNUP_URL` is set, the form shows the "couldn't save" message instead of pretending it worked.

**Changing the script later:** paste the new code, save, then **Deploy → Manage deployments** → pencil
icon → Version: **New version** → **Deploy**. This keeps the same URL. ("New deployment" would give you a
new URL, and you would have to update the page.)

## Step 2: put the website live (about 10 minutes)

**Use Netlify, not Vercel.** Vercel's free Hobby plan is for personal, non-commercial use only, and
Agos is a business. Netlify's free plan allows commercial sites. Both work the same way: they publish
this GitHub repository and republish on every push.

1. Go to [app.netlify.com/signup](https://app.netlify.com/signup) and sign up with **GitHub**
   (the franchisekid43-cmyk account).
2. **Add new project** (or **Add new site**) → **Import an existing project** → **GitHub**.
   Pick **Oliver-Apollo**. If it isn't listed, click **Configure the Netlify app on GitHub** and give
   Netlify access to that repository.
3. On the settings screen:
   - **Branch to deploy:** the branch that holds the site. Today that is `claude/peaceful-cerf-1x3t9f`.
     If you merge it into the default branch, pick that one instead.
   - **Base directory:** `agos-site`
   - **Build command:** leave empty
   - **Publish directory:** `agos-site/public`. `netlify.toml` sets this too, so only `public/` is ever
     on the website. The script, tests and this README stay private.
4. Click **Deploy**. About 30 seconds later you get a random address like `jolly-otter-123.netlify.app`.
5. Change the name: **Project configuration** (or **Site configuration**) → **Change name** → `agos`,
   for `agos.netlify.app`. If it's taken, try `agos-ph` or `getagos`.

**No-GitHub alternative:** go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the
`agos-site/public` folder onto the page. Sign up to keep the site, then rename it as in step 5.

**Vercel instead** (for example if you move to its paid Pro plan later): **Add New… → Project** →
import **Oliver-Apollo** → Framework Preset **Other**, Root Directory **`agos-site`**. `vercel.json`
already points it at `public/`. Vercel publishes the repository's default branch, currently
`claude/new-session-7o1kb8`, so merge this branch into it first.

### Redeploying after edits

- **Netlify with GitHub:** edit `public/index.html`, commit and push to the branch you picked.
  The new version is live in under a minute. **Deploys** lists every version, and any older one can be
  put back with **Publish deploy**.
- **Netlify Drop:** open the site → **Deploys** → drag the `public` folder in again.
- **Script changes:** see "Changing the script later" above. The website needs no redeploy.

### Adding your own domain later (for example getagos.ph)

1. Buy the domain. `.ph` domains are sold by [dot.ph](https://www.dot.ph) and its resellers. This is
   the only part that costs money, and it's optional.
2. In Netlify: your site → **Domain management** → **Add a domain** → `getagos.ph`. Netlify adds
   `www.getagos.ph` as well and redirects one to the other.
3. Netlify then shows the DNS records to add at your registrar (or offers to host the DNS for you,
   which is simplest: you change the domain's nameservers to the four Netlify shows). Copy exactly what
   Netlify shows.
4. Wait. It usually takes minutes, sometimes a few hours. Netlify turns on HTTPS by itself when the
   domain points to it.

Nothing else changes. The Sheet's "Source page" column shows which address each sign-up came from.

## Step 3: test before calling it done

On the live address:

1. Fill in the form with an obviously fake business (for example `TEST delete me`) and submit.
   The button says **Sending…**, then the thank-you screen appears.
2. Within a minute: a new row in the **Sign-ups** tab, and a "New Agos sign-up: …" email at
   helloagos.ph@gmail.com. Delete the test row.
3. **Phone width:** open the address on your phone. On a computer, Chrome → right-click → **Inspect** →
   the phone/tablet icon.
4. **Dark mode:** switch your phone to dark mode and reload. In Chrome DevTools: **⋮ → More tools →
   Rendering → Emulate CSS prefers-color-scheme: dark**.
5. **Console errors:** in DevTools, the **Console** tab should have no red lines after loading the page
   and after the test sign-up.

Before it went to you, the page was tested in Chromium at desktop, 390 px and 320 px widths, in light
and dark mode, with the Apps Script mocked: saving, the sending state, the thank-you screen, the error
message (everything typed is kept), both spam traps, and the Pixel events. Only the real Google
round-trip is left for this step.

## Welcome email

After saving the row and notifying helloagos, the script emails the applicant, using the wording in
[BRIEF-welcome-email.md](BRIEF-welcome-email.md):

- It goes **only** to the address the applicant typed, from helloagos.ph@gmail.com, shown as "Agos",
  with replies going to helloagos.
- It is sent only if the script runs as helloagos.ph@gmail.com. Under any other account it is not sent,
  so the Philindo address can never reach an applicant.
- It is skipped for test sign-ups: any word in the Name or Business starting with "test" ("TEST",
  "Test Co", "Testing"). "Fastest Cargo" or "Contest Freight" still get their welcome.
- The **Welcome sent** column shows `Yes`, `No (test)`, `Not sent (wrong account)`,
  `No (invalid email)` or `Failed`. A failed welcome never stops the row saving or the team's notification.

Gmail lets a free account send about 100 emails a day from scripts. Each sign-up uses two (notification
and welcome), so past roughly 50 sign-ups in a day the emails stop until the next day. Rows still save.

## Spam protection

The form has a hidden "Leave this field empty" box that people never see, and it also records how long
after page load the form was sent. Anything that fills the box or submits within 3 seconds gets the
thank-you screen but is not saved. The script checks both again, so bots that skip the page are
rejected too. No CAPTCHA.

## Meta Pixel (off)

To switch it on, put your Pixel ID in `public/index.html` (next to `SIGNUP_URL`):

```js
var PIXEL_ID = '123456789012345';
```

It fires **PageView** on load and **Lead** after a sign-up is saved.

**Before switching it on:** the privacy notice on the page says "We collect only what's on this form".
The Pixel also sends browsing data (cookies, pages visited) to Meta, so that sentence would no longer
be true. Update the privacy notice first (the Data Privacy Act expects it). The brief says to keep
the notice unchanged, so it was left alone.

## Agos Verified in the Sheet

Each sign-up row ends with the team's columns:

| Column | Who fills it | Meaning |
|---|---|---|
| **Agos Verified** | Team (tick box) | Tick only after checking the business and every document in its file: complete, current and consistent. |
| Verified on | Automatic | Date and time the tick was made (Manila). |
| **Forwarded to lenders** | Team (tick box) | Tick when the requirements go to lenders, with the customer's approval. **Refused unless Agos Verified is ticked:** the tick is undone and a message explains why. |
| Forwarded on | Automatic | Date and time of forwarding (Manila). |
| Notes | Team | Anything: calls, missing documents, lender feedback. |

The documents themselves never come through the website. The form collects only the fields shown.
