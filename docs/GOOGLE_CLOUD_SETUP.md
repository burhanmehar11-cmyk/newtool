# Google Cloud setup for Locentio (guide for Claude Cowork)

This guide sets up the private beta's accounts and database on Google:

- **Firebase Authentication** (Google Identity Platform) for sign-in: email/password and "Continue with Google".
- **Cloud SQL for PostgreSQL** for the database.
- **Vercel** keeps hosting the app; it connects to Cloud SQL through Google's Cloud SQL connector.

It is written so **Claude Cowork can do it in the browser**, step by step, with the account owner nearby for a few approvals. It takes about 45–60 minutes, most of it waiting for the database to be created.

---

## 1. Prompt to give Claude Cowork

Copy everything in this box into Cowork, then attach or link this guide.

```
Please set up Google Cloud for my app "Locentio" by following the guide in
docs/GOOGLE_CLOUD_SETUP.md of the GitHub repo burhanmehar11-cmyk/newtool
(branch claude/compassionate-knuth-hewpfn). Work in my browser, in order,
part by part.

Rules:
- Stop and ask me before: linking or enabling billing, creating the Cloud SQL
  instance, or deleting/changing anything that already existed.
- Never type, paste, read aloud or screenshot secrets in our chat: the
  service account key file and the database password. When a step needs a
  secret, stop and ask me to handle it myself.
- After each part, tell me what you did and the non-secret values you
  recorded (project ID, Firebase web config, Cloud SQL connection name).
- If a page looks different from the guide, describe what you see and ask.
- If something fails (permissions, organisation policy, quota), stop and
  report the exact error message.
```

## 2. What the owner prepares first

| Item | Example | Notes |
| --- | --- | --- |
| Google account with permission to create projects | you@yourcompany.com | Owner or Project Creator in the Google Cloud organisation (if any). |
| A billing account | — | Cloud SQL is a paid service. Firebase Authentication is free at beta volumes. |
| Your app's public URL | `https://newtool.vercel.app` | From Vercel → your project → Domains. Add a custom domain too, if you have one. |
| Invite list | `you@agency.com,@partner.com` | Emails or whole @domains allowed to create accounts during the beta. |
| Region | `us-central1` or the region closest to your users | Use the same region everywhere. |

Values Cowork will record (none of these are secrets):

```
PROJECT_ID              =
FIREBASE apiKey         =   (public identifier, not a secret)
FIREBASE authDomain     =
FIREBASE projectId      =
FIREBASE appId          =
CLOUD_SQL connection    =   PROJECT_ID:REGION:locentio-db
```

---

## Part A: Google Cloud project

1. Open https://console.cloud.google.com/ and make sure the correct Google account is selected (top right).
2. Click the project picker (top bar) → **New project**.
   - Project name: `Locentio`
   - Organisation and location: keep the defaults unless the owner says otherwise.
   - Click **Create**, wait, then select the new project in the picker.
3. Record the **Project ID** shown on the dashboard (for example `locentio-482913`). It's often different from the name.
4. **Billing (owner approval needed).** Go to **Billing** in the left menu. If the project has no billing account, **stop and ask the owner** to link one. Do not create a new billing account without approval.

✅ Check: the dashboard shows the Locentio project with a billing account linked.

## Part B: Enable the APIs

1. Go to **APIs & Services → Library**.
2. Search for and **Enable**:
   - **Cloud SQL Admin API** (the connector uses it)
   - **Identity Toolkit API** (Firebase Authentication; Firebase may enable it automatically)

✅ Check: both appear under **APIs & Services → Enabled APIs & services**.

## Part C: Firebase Authentication

1. Open https://console.firebase.google.com/ → **Create a project** (or **Add project**).
2. Choose **"Add Firebase to an existing Google Cloud project"** and pick the Locentio project from Part A. Do not create a separate project.
3. Google Analytics: **turn it off** (not needed). Finish.
4. Left menu **Build → Authentication → Get started**.
5. Tab **Sign-in method**:
   - **Email/Password** → Enable the first switch (Email/Password). Leave "Email link (passwordless sign-in)" **off**. Save.
   - **Google** → Enable. Set "Support email for project" to the owner's email. Save.
6. Tab **Settings → Authorized domains** → **Add domain**:
   - The Vercel domain without `https://`, for example `newtool.vercel.app`
   - Any custom domain the app uses
   - `localhost` should already be there; leave it.
7. Optional: **Templates** tab → edit the email templates so the sender name reads "Locentio".
8. Gear icon → **Project settings → General → Your apps** → click the **Web (`</>`)** icon.
   - App nickname: `Locentio web`. Do **not** tick Firebase Hosting. Register.
   - Firebase shows a `firebaseConfig` snippet. Record `apiKey`, `authDomain`, `projectId` and `appId`. These are public identifiers that ship to the browser, so they are safe to note down.

✅ Check: Authentication → Sign-in method lists Email/Password and Google as **Enabled**.

## Part D: Service account key (owner does the secret part)

One service account key lets the app verify sign-ins (Firebase Admin) and connect to Cloud SQL.

1. Firebase console → gear → **Project settings → Service accounts**.
2. Note the service account email shown, like `firebase-adminsdk-xxxxx@PROJECT_ID.iam.gserviceaccount.com`.
3. **Stop here and ask the owner** to click **Generate new private key** → **Generate key**. A JSON file downloads. The owner keeps it safe and never shares it in chat or email.
   - If Google shows an error about an organisation policy (`iam.disableServiceAccountKeyCreation`), stop and report it. An organisation admin must allow key creation for this project.
4. Back in https://console.cloud.google.com/ → **IAM & Admin → IAM**.
5. Find the `firebase-adminsdk-…` service account → pencil icon (**Edit principal**) → **Add another role** → **Cloud SQL Client** → Save.

✅ Check: the IAM list shows that service account with **Cloud SQL Client**, plus its existing Firebase roles.

## Part E: Cloud SQL for PostgreSQL (owner approval needed)

**Ask the owner before creating the instance.** It is billed by the hour from creation, even when idle.

1. Console → **SQL** → **Create instance** → **Choose PostgreSQL**.
2. Settings:
   - **Edition:** Enterprise (not Enterprise Plus).
   - **Preset:** Sandbox or Development (the cheapest the page offers).
   - **Database version:** PostgreSQL 16 or newer.
   - **Instance ID:** `locentio-db`
   - **Password (postgres user):** click **Generate**. **Ask the owner to copy this password into their password manager now.** It is needed again in Part G. Do not record it in chat.
   - **Region:** the region chosen in section 2. **Zonal availability:** Single zone (fine for the beta).
3. Expand **Show configuration options**:
   - **Machine configuration:** the smallest shared-core option offered. Confirm the monthly estimate on the right with the owner.
   - **Connections:** **Public IP** checked. Do **not** add any authorised networks. The app connects through the encrypted Cloud SQL connector, so no IP needs to be opened.
   - **Data protection:** automated backups **on**, deletion protection **on**.
4. Click **Create instance** and wait (about 5–15 minutes).
5. When it's ready, on the instance **Overview** page record the **Connection name** (`PROJECT_ID:REGION:locentio-db`).
6. Left menu of the instance → **Databases** → **Create database** → name `locentio` → Create.
7. Instance → **Connections → Security**: set SSL mode to **Allow only SSL connections** → Save.

✅ Check: the instance is green (running), and the database `locentio` is listed.

## Part F: Create the tables (run the two migration files)

1. Instance → **Cloud SQL Studio** (left menu).
2. Sign in: Database `locentio`, user `postgres`, authentication **Built-in database authentication**. **Ask the owner to type the password** from Part E.
3. Open a new **Editor** tab.
4. In another browser tab, open the GitHub repo **burhanmehar11-cmyk/newtool**, branch `claude/compassionate-knuth-hewpfn`, file `database/migrations/0000_auth.sql`. Click the **Copy raw file** button (two-squares icon above the code).
5. Paste it into the Cloud SQL Studio editor and click **Run**. It should finish with no errors.
6. Clear the editor. Do the same with `database/migrations/0001_foundation.sql`, then **Run**.
7. Verify by running:

   ```sql
   select
     (select count(*) from information_schema.tables where table_schema = 'public') as public_tables,
     (select count(*) from information_schema.tables where table_schema = 'auth') as auth_tables;
   ```

   Expected: `public_tables = 30`, `auth_tables = 1`.

If a migration fails partway, **stop and report the exact error**. Do not run it a second time until we've looked at it: some statements would already exist.

## Part G: Vercel environment variables

1. Open https://vercel.com → the Locentio project (`newtool`) → **Settings → Environment Variables**.
2. Add each variable below for **Production** (and **Preview**, if preview deployments should have sign-in too).

| Name | Value | Who enters it |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The public URL, e.g. `https://newtool.vercel.app` | Cowork |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` from Part C | Cowork |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` from Part C | Cowork |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` from Part C | Cowork |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` from Part C | Cowork |
| `CLOUD_SQL_INSTANCE` | Connection name from Part E | Cowork |
| `DB_USER` | `postgres` | Cowork |
| `DB_NAME` | `locentio` | Cowork |
| `BETA_ALLOWED_EMAILS` | The invite list from section 2 | Cowork |
| `DB_PASSWORD` | The postgres password from Part E. Mark it **Sensitive**. | **Owner** |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The **entire contents** of the JSON key file from Part D, pasted as-is (opening `{` to closing `}`). Mark it **Sensitive**. | **Owner** |

3. **Deployments** → the latest production deployment → **⋯ → Redeploy**. `NEXT_PUBLIC_*` values only take effect after a new build.

✅ Check: after the redeploy, `https://YOUR-URL/sign-in` shows the sign-in form with "Continue with Google", not "Accounts aren't configured".

## Part H: First sign-in test (owner)

1. Open `/sign-up` and create an account with an email on the invite list. Use a strong password.
2. Open the confirmation email and click the link. It returns to `/sign-in`.
3. Sign in. You land on workspace setup. Complete it.
4. The Overview page shows your workspace name and the usage allowance.
5. Optional isolation check: sign out, create a second invited account, set up its own workspace, and confirm it can't see the first workspace anywhere.
6. Optional database check in Cloud SQL Studio: `select email, created_at from auth.users;` lists the accounts.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Accounts aren't configured in this environment" | A variable is missing or the app wasn't redeployed | Recheck Part G, then redeploy |
| "This domain isn't authorised for sign-in yet" | Domain missing from Firebase authorised domains | Part C step 6 |
| "This email isn't on the private-beta list yet" | Email not in `BETA_ALLOWED_EMAILS` | Add the email or `@domain`, then redeploy |
| "Confirm your email first" | Email/password account not verified | Click the link in the email (check spam), or use "Resend the link" |
| Sign-in works but the app errors after it | The app can't reach Cloud SQL | Confirm the Cloud SQL Admin API is enabled (Part B), the service account has **Cloud SQL Client** (Part D), `CLOUD_SQL_INSTANCE` is the exact connection name, and the instance is running |
| Migration error mentioning `grant authenticated to current_user` | Run as a user other than `postgres` | Sign in to Cloud SQL Studio as `postgres` and run it again on a fresh database |
| Key creation blocked | Organisation policy | An organisation admin must allow service account keys for this project |

## Security notes

- Never commit the JSON key or the database password to GitHub. They belong only in Vercel's Sensitive variables and the owner's password manager.
- If the key is ever exposed, delete it in **IAM & Admin → Service accounts → Keys** and generate a new one.
- `NEXT_PUBLIC_FIREBASE_*` values are public by design. Access is protected by the authorised domains, the server-side session check and the database's row-level security.
- Later, for production: consider a dedicated database user with fewer privileges and Workload Identity Federation instead of a key file. Tracked in `docs/HANDOFF.md`.

## Coming later (not needed yet)

Gmail sending (M2 step 5) will add one more Google Cloud task: an OAuth consent screen, the Gmail API, and an OAuth client for "Connect Gmail". Gmail sending scopes are restricted, so a public launch needs Google's verification. A separate guide will cover it when that step is built.
