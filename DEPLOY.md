# MediQueue v2 — Deployment Guide

> Full stack: Next.js 16 · Supabase · Stripe · Vercel  
> Time to first deploy: ~30 minutes

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Supabase CLI | latest | `npm i -g supabase` |
| Vercel CLI | latest | `npm i -g vercel` |

---

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region closest to your users
3. Set a strong database password (save it — you'll need it for migrations)
4. Once the project is ready, go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**never expose client-side**)

---

## Step 2 — Apply database migrations

Link the Supabase CLI to your project and push the schema:

```bash
# From the repo root
supabase login
supabase link --project-ref <your-project-ref>

# Push all migrations in supabase/migrations/
supabase db push
```

The schema creates the following tables (all with RLS enabled):

| Table | Purpose |
|---|---|
| `patients` | Patient records (name, phone) |
| `doctors` | Doctor profiles (name, specialty, is_live, counters) |
| `queue_entries` | One row per token (status state machine) |
| `activity_log` | Append-only clinic event log |

Also runs the `next_token_number(p_doctor_id)` SQL function used by the booking API.

---

## Step 3 — Create a Stripe account (optional — for paid features)

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → API keys**
2. Copy:
   - Secret key → `STRIPE_SECRET_KEY`
   - Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Create a webhook endpoint pointing to `https://<your-domain>/api/webhooks/stripe`
4. Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`

If you are not using Stripe yet, set these to empty strings in your Vercel dashboard — the app will start without them.

---

## Step 4 — Set up OpenAI (for AI Symptom Checker)

1. Go to [platform.openai.com](https://platform.openai.com) → **API keys → Create new**
2. Copy the key → `OPENAI_API_KEY`

Without this key the symptom checker returns a 503 with a clear message. All other features work normally.

---

## Step 5 — Connect the repo to Vercel

```bash
cd mediqueue-v2
npx vercel
```

Follow the prompts:
- **Set up and deploy?** → Y
- **Which scope?** → select your team or personal account
- **Link to existing project?** → N (first time), then name it `mediqueue-v2`
- **In which directory is your code located?** → `./` (already inside `mediqueue-v2/`)
- Vercel auto-detects Next.js — accept all defaults

This creates a preview deployment. Do **not** promote it to production yet — add env vars first.

---

## Step 6 — Add environment variables in Vercel

In the [Vercel Dashboard](https://vercel.com/dashboard) → your project → **Settings → Environment Variables**, add all of the following for **Production**, **Preview**, and **Development**:

```
NEXT_PUBLIC_SUPABASE_URL          = https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <anon key from Step 1>
SUPABASE_SERVICE_ROLE_KEY         = <service role key from Step 1>

STRIPE_SECRET_KEY                 = sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
STRIPE_WEBHOOK_SECRET             = whsec_...

OPENAI_API_KEY                    = sk-...

NEXT_PUBLIC_POSTHOG_KEY           = phc_...
NEXT_PUBLIC_POSTHOG_HOST          = https://app.posthog.com

SENTRY_DSN                        = https://...@....ingest.sentry.io/...
```

> **Security:** `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`, and `STRIPE_WEBHOOK_SECRET` must **never** be set as `NEXT_PUBLIC_*` variables. They are server-only.

---

## Step 7 — Trigger production deploy

```bash
# Promote the latest preview to production
npx vercel --prod
```

Or push to `main` — GitHub Actions runs the CI check, and Vercel auto-deploys on success.

---

## Step 8 — Verify the deployment

| Check | URL |
|---|---|
| Patient Portal | `https://<your-domain>/patient` |
| Symptom Checker | `https://<your-domain>/symptom-check` |
| Doctor Dashboard | `https://<your-domain>/doctor?doctor_id=<uuid>` |
| Admin Dashboard | `https://<your-domain>/admin` |
| Queue stats API | `https://<your-domain>/api/queue/stats` |

### Post-deploy checklist

- [ ] Supabase RLS is enabled on all four tables
- [ ] At least one doctor row exists (`/admin` → Add Doctor)
- [ ] Doctor `is_live` toggled on via the Doctor Dashboard
- [ ] Booked a test token via `/patient` and confirmed it appears in the Live Queue
- [ ] Sentry dashboard shows no new errors on first load
- [ ] PostHog dashboard shows pageview events firing

---

## Rollback

Vercel keeps every deployment. To roll back:

```bash
npx vercel rollback
```

Or use the Vercel Dashboard → **Deployments** → click any previous deploy → **Promote to Production**.

---

## Local development

```bash
cp .env.example .env.local
# Fill in your Supabase dev project keys

npm install
npm run dev        # http://localhost:3000
```

Run checks before pushing:

```bash
npx tsc --noEmit   # Type safety
npm run lint       # ESLint
npm run build      # Production build (catches missing env vars)
```
