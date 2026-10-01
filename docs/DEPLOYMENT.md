# Deploying JalSuraksha Nepal (Supabase + Vercel)

Budget about 20 minutes. You need a Supabase account, a Vercel account and
this repo on GitHub.

## 1. Supabase

### 1.1 Create the project and apply migrations

1. Create a project at [supabase.com](https://supabase.com). The Mumbai
   (`ap-south-1`) region is the closest to Nepal.
2. Link and push the schema from your machine:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # applies supabase/migrations/*
   ```

3. Load the simulated demo data, using either:
   - **SQL editor:** paste the contents of `supabase/seed.sql` and run it, or
   - `psql "<connection string>" -f supabase/seed.sql`

   The seed uses `now()`-relative timestamps. Later you can refresh the data from
   **Presentation mode → Reset demo data** in the app.

### 1.2 Authentication settings

Under **Authentication → Sign In / Providers**:

| Setting | Value | Why |
|---|---|---|
| Allow anonymous sign-ins | **On** | Guest SOS gets realtime updates without creating an account |
| Email provider | On; you may turn off "Confirm email" for staff demo accounts | Operators, rescue teams and admins use email/password |
| Phone provider | On (any provider; its credentials are not used because the Send SMS hook below delivers the codes) | Citizen OTP login |
| Test phone numbers | `9779800000001=123456` | Demo citizen login without sending an SMS |

> **SMS in Nepal:** real OTP delivery needs an SMS provider that can reach
> Nepali networks (NTC/Ncell). For the hackathon, test phone numbers or the
> **Citizen Demo** button are enough. Emergency SOS never needs a login.

#### Login codes by SMS (Send SMS hook → Twilio)

Supabase creates and checks the codes. The app delivers them through
`/api/auth/send-sms`, which sends a real SMS with Twilio.

1. **Twilio:** create an account at twilio.com. In the console, copy the
   **Account SID** and **Auth Token**. Then either buy a number (sender, e.g.
   `+1…`) or create a **Messaging Service** (`MG…`). Under **Messaging →
   Settings → Geo permissions**, allow **Nepal**. A trial account only sends to
   numbers you have verified in the console, and prefixes a trial notice.
   Delivery to Nepal may require a registered alphanumeric sender ID; check
   Twilio's Nepal guidelines before launch.
2. **Supabase → Authentication → Hooks → Send SMS hook:** type **HTTPS**,
   URL `https://<your-vercel-domain>/api/auth/send-sms`, then **Generate
   secret** and copy it (`v1,whsec_…`).
3. **Vercel env:** `SEND_SMS_HOOK_SECRET` = that secret, plus
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and either
   `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`. Redeploy.
4. Sign in with your own number: the code should arrive by SMS. If it fails,
   the sign-in screen says so and the Vercel function log shows Twilio's
   error code.

Without Twilio variables a production build never prints or reveals codes;
sign-in with real numbers fails with an honest message (test numbers still
work).

Under **Authentication → URL Configuration**, set the **Site URL** to your
Vercel URL and add it to the redirect URLs.

### 1.3 Realtime and Storage

Both are created by the migrations: the `supabase_realtime` publication
includes the SOS, assignment, team, hazard, shelter, alert and history tables,
and the `sos-photos` (private) and `hazard-photos` (public) buckets exist. To
check, open **Database → Publications → supabase_realtime** and **Storage**.

### 1.4 Keys

Under **Project Settings → API Keys**, copy:
- the **Project URL**
- the **publishable key** (`sb_publishable_…`), or the legacy `anon` key
- the **secret key** (`sb_secret_…`), or the legacy `service_role` key. It is **server-only**

## 2. Vercel

1. **Add New → Project** and import the GitHub repository. Framework: Next.js (auto-detected).
2. Environment variables (Production + Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key |
   | `SUPABASE_SECRET_KEY` | secret/service-role key |
   | `NEXT_PUBLIC_DEMO_MODE` | `true` for the hackathon, `false` otherwise |
   | `DEMO_ACCOUNT_PASSWORD` | a strong password, 8+ characters |
   | `SMS_GATEWAY_SECRET` | leave empty (keeps the SMS endpoint disabled) |
   | `SEND_SMS_HOOK_SECRET` | the Send SMS hook secret (see 1.2) |
   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | from the Twilio console |
   | `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER` | one of the two |

3. Deploy. Then add the deployment URL to Supabase **Auth → URL Configuration**.

## 3. Demo accounts

Run this once from your machine against the hosted project:

```bash
# .env.local containing the hosted URL, secret key and DEMO_ACCOUNT_PASSWORD
npm run demo:users
```

It must use the **same** `DEMO_ACCOUNT_PASSWORD` you set in Vercel, because the
login page's demo buttons sign in on the server with that value.

## 4. Smoke test (5 minutes)

0. Sign in as Operator Demo, open **Presentation mode** and check the **System check** card reads "Ready to present" (or open `/api/health` while signed in).
1. `/citizen` shows **FLOOD DANGER** and the map, with streets visible.
2. `/auth/login` → **Operator Demo** opens the Operations Centre with live KPIs.
3. In a private window, `/auth/login` → **Rescue Team Demo** shows "No active mission".
4. On a phone, send the demo SOS. It appears on the dashboard within about a second.
5. Assign R-03, advance the rescue statuses, and watch the phone update.
6. **Presentation mode → Reset demo data** to clean up.

## 5. Before a real deployment

- Set `NEXT_PUBLIC_DEMO_MODE=false`, delete the demo accounts, and replace all simulated data.
- Integrate official DHM data and validate the risk weights with hydrologists.
- Replace the in-memory rate limiter with a shared store.
- Configure an SMS provider with Nepal delivery, and review data retention for SOS records.
