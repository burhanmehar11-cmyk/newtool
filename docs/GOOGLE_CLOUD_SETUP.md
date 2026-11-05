# Free setup: "Sign in with Google" (guide for Claude Cowork)

This turns on sign-in for Locenti's private beta **without paying for anything**:

- **Google Cloud Console:** create a free project and an OAuth client so people can sign in with their Google (Gmail) account. No billing account is needed.
- **Vercel:** add the free Postgres database (Neon) so workspaces can be saved, then add a few settings.

It's written so **Claude Cowork can do it in your browser**. You step in for two secret values. Expect about 20–30 minutes.

> Why a database at all? Sign-in only proves who someone is. The app still has to remember each person's workspace, offer profile and, later, their leads. Vercel's Neon Postgres has a free plan and needs no card.

---

## 1. Prompt to give Claude Cowork

```
Please set up free Google sign-in for my app "Locenti" by following
docs/GOOGLE_CLOUD_SETUP.md in the GitHub repo burhanmehar11-cmyk/newtool
(branch claude/compassionate-knuth-hewpfn). Work in my browser, part by part.

Rules:
- Do not add a billing account, start a trial, or choose any paid plan.
  Always pick the free option. If a page insists on payment, stop and ask me.
- Never type, paste, read aloud or screenshot secrets in our chat: the
  Google client secret and the session secret. When a step needs one,
  stop and ask me to paste it myself.
- Don't delete or change anything that already existed without asking.
- After each part, tell me what you did and the non-secret values you
  recorded (project ID, OAuth client ID).
- If a page looks different from the guide, describe what you see and ask.
  If something fails, stop and report the exact message.
```

## 2. What the owner prepares

| Item | Example |
| --- | --- |
| The Google account that will own the setup | you@gmail.com |
| Your app's public URL (Vercel → project → **Domains**) | `https://newtool.vercel.app` |
| Who may sign in during the beta (Gmail addresses or whole @domains) | `you@gmail.com,partner@gmail.com,@youragency.com` |

---

## Part A: Free Google Cloud project

1. Open https://console.cloud.google.com/ and check the right Google account is selected (top right).
   - On a first visit, accept the terms. **Ignore any "Start free trial" or billing offers.** They aren't needed.
2. Project picker (top bar) → **New project** → name it `Locenti` → **Create**. Select it in the picker.
3. Record the **Project ID** from the dashboard.

✅ Check: the top bar shows the Locenti project. No billing was added.

## Part B: Consent screen (what people see when they click "Continue with Google")

Google calls this **Google Auth Platform** (older screens say **OAuth consent screen**).

1. Left menu → **APIs & Services → OAuth consent screen**, or search "Google Auth Platform". Click **Get started** if shown.
2. **App information:** App name `Locenti`; User support email: the owner's email. **Next.**
3. **Audience:** choose **External**. **Next.**
4. **Contact information:** the owner's email. **Next.** Agree to the policy → **Create**.
5. Open **Audience** (left menu of Google Auth Platform):
   - Publishing status should be **Testing**. Keep it in Testing for the private beta: only the test users you list can sign in, and Google doesn't need to review the app.
   - **Test users → Add users:** add every Gmail address from the beta list (max 100). Save.
6. Open **Data access** (or **Scopes**): you don't need to add anything. The app only asks for `openid`, `email` and `profile`, which are basic and free.

✅ Check: Audience shows **Testing** and lists your test users.

## Part C: OAuth client (the app's Google login key)

1. Google Auth Platform → **Clients** (or **APIs & Services → Credentials → Create credentials → OAuth client ID**).
2. **Create client** → Application type **Web application** → name `Locenti web`.
3. **Authorized JavaScript origins → Add URI:**
   - `https://newtool.vercel.app` (your real URL, no trailing slash)
   - `http://localhost:3000` (for local development)
4. **Authorized redirect URIs → Add URI** (must match exactly):
   - `https://newtool.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
   - Add the same two lines for any custom domain you use.
5. **Create.** A dialog shows the **Client ID** and **Client secret**.
   - Record the **Client ID** (it ends in `.apps.googleusercontent.com`; not secret).
   - **Stop and ask the owner** to copy the **Client secret** themselves. It goes straight into Vercel in Part E. (It can be viewed again later in the client's details.)

✅ Check: Clients lists `Locenti web` with both redirect URIs.

## Part D: Free database in Vercel

1. Open https://vercel.com → your project (`newtool`) → **Storage** tab.
2. **Create Database** → choose **Neon** (Serverless Postgres) → **Continue**.
   - Plan: **Free**. Do not pick a paid plan.
   - Region: the one closest to your users (or the default). Name: `locenti-db`.
   - Accept the integration terms when asked, then **Create**.
3. When asked which environments to connect, keep **Production** and **Preview** (and **Development** if offered). Vercel adds `DATABASE_URL` and related settings automatically.
4. Open the database's **Open in Neon** (or **Neon Console**) link → **SQL Editor**.
5. In another tab, open GitHub → **burhanmehar11-cmyk/newtool** → branch `claude/compassionate-knuth-hewpfn` → `database/migrations/0000_auth.sql` → **Copy raw file** (two-squares icon). Paste into the SQL Editor → **Run**.
6. Clear the editor. Do the same, one file at a time, with `database/migrations/0001_foundation.sql` → **Run**, then `0002_password_and_discovery.sql` → **Run**, then `0003_research.sql` → **Run**, then `0004_google_places.sql` → **Run**, then `0005_mailboxes.sql` → **Run**, then `0006_campaigns.sql` → **Run**, then `0007_agents.sql` → **Run**, then `0008_replies.sql` → **Run**, then `0009_team.sql` → **Run**, then `0010_followups.sql` → **Run**.
   - Already ran some of them earlier? Run only the ones after the last you ran (for example just **0003**). Later files only add things and are safe to run on top.
7. Check by running:

   ```sql
   select
     (select count(*) from information_schema.tables where table_schema = 'public') as public_tables,
     (select count(*) from information_schema.tables where table_schema = 'auth') as auth_tables;
   ```

   Expected: `public_tables = 31`, `auth_tables = 4` (0003 and 0004 don't add tables to these schemas, so the counts don't change).

If a migration shows an error, **stop and report the exact message**. Don't run it twice.

✅ Check: the counts match, and the Vercel project's **Settings → Environment Variables** now includes `DATABASE_URL`.

## Part E: Settings in Vercel

Vercel → project → **Settings → Environment Variables**. Add each one for **Production** (and **Preview**, if you use preview links).

| Name | Value | Who enters it |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your public URL, e.g. `https://newtool.vercel.app` | Cowork |
| `GOOGLE_OAUTH_CLIENT_ID` | The Client ID from Part C | Cowork |
| `BETA_ALLOWED_EMAILS` | The beta list from section 2, comma-separated | Cowork |
| `GOOGLE_OAUTH_CLIENT_SECRET` | The Client secret from Part C. Mark **Sensitive**. | **Owner** |
| `SESSION_SECRET` | A random string of **at least 32 characters** (a password manager's generator works well; 40+ characters, letters and numbers). Mark **Sensitive**. | **Owner** |

`DATABASE_URL` was added by Part D; leave it as is.

Then **Deployments** → latest production deployment → **⋯ → Redeploy**. Settings only take effect after a new deployment.

✅ Check: `https://YOUR-URL/sign-in` shows a **Continue with Google** button instead of "Sign-in isn't configured".

## Part E2: Email + password sign-in (optional, free)

Google sign-in works without this. Add it if invited people should also be able to sign in with an email and password. It sends their confirmation and password-reset emails from a Gmail account.

1. The Gmail account that will send these emails needs **2-Step Verification** on: https://myaccount.google.com/security
2. Open https://myaccount.google.com/apppasswords → app name `Locenti` → **Create**. Google shows a 16-character **App Password**. **The owner copies it; it's a secret.**
3. In Vercel, the owner adds `SMTP_URL` (mark **Sensitive**), built like this. Replace the `@` in the Gmail address with `%40`, and remove the spaces from the App Password:

   ```
   smtps://yourname%40gmail.com:abcdabcdabcdabcd@smtp.gmail.com:465
   ```

4. Optional: `EMAIL_FROM` = the address shown as sender (defaults to that Gmail address).
5. **Redeploy.** `/sign-up` now shows the email form, and "Forgot your password?" sends reset links.

Gmail's free sending limit (about 500 emails a day) is far more than sign-ups and resets need.

## Part E3: Google Maps search (optional, free within Google's monthly allowance)

Google Maps search uses the official **Places API (New)**. Google requires a billing account on the project even for free usage, but Locenti is set up to stay inside the free allowance (Text Search with website/phone/rating: 1,000 free requests a month at the time of writing, up to 20 businesses each).

1. Google Cloud Console → ☰ → **Billing** → link the project to a billing account. Stop if it asks you to choose a paid support plan or prepay. Ask the owner before adding a card.
2. **APIs & Services → Library** → search **Places API (New)** → **Enable**. (Not the old "Places API": new projects can't enable it, and the page keeps reloading.)
3. **APIs & Services → Places API (New) → Quotas & System Limits** → find the **per day** limit for Text Search requests → **Edit** → set **30** → Save. This is Google's hard cap; requests beyond it fail instead of costing money.
4. **APIs & Services → Credentials → Create credentials → API key**. On the key: **API restrictions → Restrict key → Places API (New)** → Save. Don't type or paste the key into chat.
5. Vercel → Settings → Environment Variables: `GOOGLE_PLACES_API_KEY` = the key (Production and Preview), optionally `GOOGLE_PLACES_DAILY_LIMIT` = `30`. Redeploy.
6. Run `database/migrations/0004_google_places.sql` in Neon's SQL Editor (adds the daily call counter).

Check: in the app, **Discover** shows a **Google Maps** / **OpenStreetMap** switch and "N left today".

## Part G: Gmail sending (free)

Uses the **same OAuth client** as sign-in. No new credential is needed. Locenti asks for Gmail access only when someone clicks **Connect Gmail**, and only for the `gmail.send` permission (send, not read).

1. **APIs & Services → Library → Gmail API → Enable** (done if you already enabled it).
2. **Google Auth Platform → Branding** (or "OAuth consent screen"):
   - App name `Locenti`, user support email, developer contact email.
   - **App logo (optional):** upload `public/brand/locentio-logo-120.png` from the repository (120×120 PNG). Google may ask for brand verification before it shows a logo to everyone; while the app is in **Testing**, that doesn't block anything. If it asks for verification and you'd rather avoid it, leave the logo empty.
   - App home page: `https://YOUR-URL`. Privacy policy: `https://YOUR-URL/legal/privacy`. Terms: `https://YOUR-URL/legal/terms`.
   - Authorised domains: your domain (for example `your-app.vercel.app`).
3. **Data Access → Add or remove scopes** → search `gmail.send` → tick `https://www.googleapis.com/auth/gmail.send` → **Update** → **Save**. It appears under sensitive scopes. Don't add read or modify scopes.
4. **Clients → (your existing Web client)** → **Authorized redirect URIs → Add URI** → `https://YOUR-URL/api/gmail/callback` → **Save**. Keep the existing `/api/auth/google/callback` URI.
   - **Using a separate client for Gmail instead?** Create it as type **Web application**, add only `https://YOUR-URL/api/gmail/callback` as its redirect URI, and set `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` in Vercel (both from that client). It must be in the same Google Cloud project, which holds the consent screen and the `gmail.send` scope.
5. **Audience → Test users**: add every Gmail address that will be connected for sending. Keep the app in **Testing**; publishing with Gmail access needs Google's verification review.
6. Neon SQL Editor: run `database/migrations/0005_mailboxes.sql`.
7. Optional: `TOKEN_ENCRYPTION_KEY` in Vercel (32 random bytes, base64). Without it, the key is derived from `SESSION_SECRET`. Changing either later means mailboxes must be reconnected.

Check: in the app, **Settings → Sending mailboxes → Connect Gmail**. On Google's screen, leave "Send email on your behalf" ticked. You'll see "This app isn't verified" in Testing; choose **Continue**. Then click **Send test email to myself**; it arrives in that inbox.

## Part G2: Reply tracking (optional)

Lets Locenti read replies to campaign emails (only threads it started), sort them, and stop emailing people who decline or bounce.

1. **Google Auth Platform → Data Access → Add or remove scopes** → search `gmail.readonly` → tick `https://www.googleapis.com/auth/gmail.readonly` → **Update** → **Save**. Google lists it under **restricted** scopes.
   - Fine in **Testing** mode for your test users. Publishing the app with this scope later needs Google's verification, including a paid third-party security assessment. Keep the app in Testing for the beta.
2. Neon SQL Editor: run `database/migrations/0008_replies.sql`.
3. In the app: **Mailboxes** → your mailbox → **Reply tracking: Turn on** → on Google's screen, leave both boxes ticked.
4. **Inbox** in the sidebar shows replies (checked every few minutes while Locenti is open, or click **Check for replies**).

## Part G3: Team invites (no Google setup)

1. Neon SQL Editor: run `database/migrations/0009_team.sql`.
2. In the app: **Team** → enter a teammate's email → **Invite** → copy the link and send it to them. If `SMTP_URL` is set, Locenti also emails it.
3. They open the link, sign in or create an account **with that email**, and click **Join**. Invited people don't need to be on `BETA_ALLOWED_EMAILS`.

## Part G4: Follow-up emails (no Google setup)

1. Neon SQL Editor: run `database/migrations/0010_followups.sql`.
2. On a draft campaign: **Follow-ups → Add follow-up** (up to two), set the wait in days, edit the text, **Save follow-ups**, then approve. They go to people who haven't replied, unsubscribed or bounced, in the same Gmail thread.

## Part H: Campaign sending (no setup needed; scheduler optional)

Run migration `0006_campaigns.sql` (step 3 below). That's all campaigns need: while Locenti is open in any browser tab, it sends the next due email about once a minute, within each campaign's hours and daily limit. **Send next due email** on a campaign page sends one immediately.

**Optional, to keep sending with no tab open:** something has to "tick" every 5 minutes. Vercel's free plan only runs scheduled jobs once a day, so use a free external scheduler:

1. Vercel → Settings → Environment Variables → add `CRON_SECRET` = a long random string (e.g. from a password generator, 32+ characters) → Production → Save → **Redeploy**.
2. Create a free account at **cron-job.org** (no card needed). **Create cronjob**:
   - URL: `https://YOUR-URL/api/cron/dispatch`
   - Schedule: every **5 minutes**
   - Advanced → Headers → add `Authorization` with value `Bearer YOUR_CRON_SECRET` (the word Bearer, a space, then the secret)
   - Save. Its history should show status **200**. A **401** means the header doesn't match `CRON_SECRET`.
3. Neon SQL Editor: run `database/migrations/0006_campaigns.sql`.

Without the scheduler, campaigns still work: the campaign page has **Send next due email**, which sends one at a time with the same limits.

## Part I: Built-in AI writer (Gemini, optional)

1. Go to **aistudio.google.com** → sign in → **Get API key** → **Create API key** (in your Locenti Google Cloud project or a new one). Don't paste it into chat.
2. Vercel → Settings → Environment Variables → `GEMINI_API_KEY` = the key → Production → Save → **Redeploy**.
3. In the app: **Agent** page shows "Ready". Open a researched lead → **Write with AI**.

Note: on Gemini's free tier, Google may use what's sent (lead research, your offer) to improve its products. A paid Gemini plan avoids that. People who connect their own agent over MCP don't use this key.

## Part J: Google app verification (publishing the consent screen)

Google checks three things before approving the app: you own the home page, the privacy policy is complete and public, and the requested permissions are justified.

1. **Owner details** are built in: Burhan Javed (founder), hello@locenti.com. Make sure that mailbox receives email. Optional in Vercel: `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_LEGAL_COUNTRY` (or override name/email with `NEXT_PUBLIC_LEGAL_NAME` / `NEXT_PUBLIC_CONTACT_EMAIL`).
2. **Prove you own the home page** (free):
   - Open **search.google.com/search-console**, signed in with the **same Google account that owns the Google Cloud project**.
   - **Add property** → **URL prefix** → `https://YOUR-URL/` (exactly the home page URL on the consent screen) → **Continue**.
   - Choose **HTML tag**. Copy only the value inside `content="..."`.
   - Vercel → Environment Variables → `GOOGLE_SITE_VERIFICATION` = that value → **Redeploy**.
   - Back in Search Console, click **Verify**.
3. **Branding page** in Google Cloud: home page `https://YOUR-URL`, privacy policy `https://YOUR-URL/legal/privacy`, terms `https://YOUR-URL/legal/terms`, authorised domain = your domain (e.g. `your-app.vercel.app`).
4. **Wait 24 hours** after verifying ownership (Google's systems need to update), then submit verification again.
5. **Scopes:** submit with `openid`, `email`, `profile` and `gmail.send` only. `gmail.readonly` (reply tracking) is a restricted scope: publishing it requires an annual third-party security assessment that costs money. Remove it from **Data Access** before submitting; reply tracking then works only for test users while the app stays in Testing, or after that assessment.
6. In the verification form, explain each scope in plain words (e.g. "gmail.send: sends emails the user reviewed and approved, from their own address") and, if asked, record a short screen video showing Connect Gmail → approve campaign → email sent.

If Google refuses a `*.vercel.app` address, the dependable fix is a custom domain (Vercel → Settings → Domains), verified in Search Console as a **Domain** property.

## Part F: First sign-in (owner)

1. Open `https://YOUR-URL/sign-in` → **Continue with Google** → pick a Gmail account that is both a **test user** (Part B) and on `BETA_ALLOWED_EMAILS` (Part E).
2. Google may say "Google hasn't verified this app". That's expected while the app is in Testing. Click **Continue**.
3. You land on workspace setup. Complete it, and the Overview shows your workspace.
4. Optional: in Neon's SQL Editor, `select email, created_at from auth.users;` shows the account.

---

## Troubleshooting

| Message | Cause | Fix |
| --- | --- | --- |
| `Error 400: redirect_uri_mismatch` (from Google) | The redirect URI registered in Part C doesn't exactly match the one the app sends | See **Fixing redirect_uri_mismatch** below |
| `Error 403: access_denied` / "app is being tested" | The Gmail account isn't a test user | Add it under Audience → Test users (Part B) |
| "This Google account isn't on the private-beta list yet" | Email missing from `BETA_ALLOWED_EMAILS` | Add it, then redeploy |
| "Email sign-up isn't available yet" | `SMTP_URL` not set | Part E2, or use Google sign-in |
| Confirmation or reset email never arrives | Wrong App Password, or the email is in spam | Check spam; recreate the App Password and update `SMTP_URL` |
| "Sign-in isn't configured in this environment yet" | A setting is missing, or no redeploy happened | Recheck Part E (`SESSION_SECRET` must be 32+ characters), then redeploy |
| "That sign-in link expired or was opened in another browser" | Took over 10 minutes, or opened in a different browser | Start again from the sign-in page |
| Signs in, then an error page | Database not connected or migrations not run | Recheck Part D; `DATABASE_URL` must exist in Vercel |

### Fixing `redirect_uri_mismatch`

1. Open `https://YOUR-URL/api/auth/google/setup` in the browser (it shows no secrets). Note `authorizedRedirectUri` and `authorizedJavaScriptOrigin`.
2. Google Cloud Console → **Google Auth Platform → Clients** → open the web client (**Locenti web**). Check that the **Client ID** starts and ends like `clientIdInUse` from step 1. If not, `GOOGLE_OAUTH_CLIENT_ID` in Vercel belongs to a different client: fix it there and redeploy.
3. Under **Authorized redirect URIs**, add `authorizedRedirectUri` **exactly** as shown (copy and paste: `https`, the full path, no trailing slash). Under **Authorized JavaScript origins**, add `authorizedJavaScriptOrigin`. **Save.**
4. Wait about 5 minutes. Google can take a few minutes, occasionally longer, to apply changes. Then try again in a new tab.
5. If the address in step 1 isn't your real site (for example it shows a `-git-` preview link), set `NEXT_PUBLIC_SITE_URL` in Vercel to your real URL and redeploy. The app then always signs in through that one address.

Tip: on Google's error page, **"error details"** shows the `redirect_uri` that was sent. It must appear in the client's list character for character.

## Cost and limits

- **Google sign-in:** free. No billing account is needed for an OAuth client with basic scopes.
- **Testing mode:** up to 100 test users. To open sign-in to anyone later, publish the app (Audience → Publish). Basic sign-in scopes don't need Google's review.
- **Neon via Vercel:** free plan with usage limits, shown on the plan page. Enough for a private beta.

## Later: Gmail sending (not needed now)

Sending campaign emails from a user's Gmail uses the **same OAuth client**, plus the Gmail API and the `gmail.send` permission. While the app stays in Testing it works for your test users at no cost. A public launch with Gmail sending needs Google's verification for that permission. A separate guide will cover it when that step is built.
