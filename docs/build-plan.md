# MediQueue v2 — Build Plan (Architect Phase)

> Produced: 2026-06-21  
> Input: docs/understand.md  
> Status: Architecture only — no feature code written.

---

## 1. Complete File List

Every file that must be created inside `mediqueue-v2/src/`.  
Files are grouped by layer. Build order is in §2.

### 1.1 App Router — Pages & Layouts

```
src/app/
```

| File | Purpose |
|---|---|
| `app/layout.tsx` | Root layout — mounts Sentry, PostHog, and Supabase session provider; sets global font |
| `app/page.tsx` | Public landing page — clinic stats strip, two CTAs, no auth required |
| `app/loading.tsx` | Root-level Suspense fallback skeleton |
| `app/error.tsx` | Root-level error boundary; reports to Sentry |
| `app/(auth)/layout.tsx` | Auth group layout — centres the card, no navbar |
| `app/(auth)/login/page.tsx` | Login form — Supabase `signInWithPassword`, role-based redirect |
| `app/(auth)/login/loading.tsx` | Skeleton while login page hydrates |
| `app/(auth)/register/page.tsx` | Registration form — creates Supabase Auth user + patients row |
| `app/(auth)/register/loading.tsx` | Skeleton while register page hydrates |
| `app/(patient)/layout.tsx` | Patient group layout — shows patient navbar, redirects unauthenticated |
| `app/(patient)/patient/page.tsx` | Patient portal — token booking form, live queue position |
| `app/(patient)/patient/loading.tsx` | Skeleton for patient portal initial load |
| `app/(patient)/patient/error.tsx` | Error boundary for patient portal async data fetches |
| `app/(patient)/symptom-check/page.tsx` | AI symptom triage form and structured result display |
| `app/(patient)/symptom-check/loading.tsx` | Skeleton for symptom check page |
| `app/(doctor)/layout.tsx` | Doctor group layout — shows doctor navbar, redirects non-doctors |
| `app/(doctor)/doctor/page.tsx` | Doctor dashboard — session toggle, queue list, call/done/skip actions |
| `app/(doctor)/doctor/loading.tsx` | Skeleton for doctor dashboard initial queue load |
| `app/(doctor)/doctor/error.tsx` | Error boundary for doctor dashboard |
| `app/(admin)/layout.tsx` | Admin group layout — shows admin navbar, redirects non-admins |
| `app/(admin)/admin/page.tsx` | Admin panel — doctor CRUD, stats, queue overview, activity feed |
| `app/(admin)/admin/loading.tsx` | Skeleton for admin panel initial data load |
| `app/(admin)/admin/error.tsx` | Error boundary for admin panel |

### 1.2 App Router — API Routes

```
src/app/api/
```

| File | Purpose |
|---|---|
| `app/api/queue/route.ts` | GET (fetch queue by doctor), POST (add entry), PATCH (update status) |
| `app/api/tokens/route.ts` | POST (issue next token — calls `next_token_number()`, inserts queue_entry) |
| `app/api/doctors/route.ts` | GET (list all), POST (create), PATCH (toggle is_live or update), DELETE (remove) |
| `app/api/ai/symptom-check/route.ts` | POST (send symptoms to GPT-4o-mini, parse structured response, log to activity_log) |
| `app/api/webhooks/stripe/route.ts` | POST (verify Stripe signature, handle `payment_intent.succeeded` and `charge.refunded`) |
| `app/api/auth/confirm/route.ts` | GET (Supabase email confirmation redirect handler — exchanges code for session) |

### 1.3 Components — UI Primitives

```
src/components/ui/
```

| File | Purpose |
|---|---|
| `components/ui/Button.tsx` | Polymorphic button — variants: primary, secondary, danger, ghost; sizes: sm, md, lg |
| `components/ui/Input.tsx` | Controlled text/number/tel input with label, error state, and helper text |
| `components/ui/Select.tsx` | Styled select with label and error state |
| `components/ui/Textarea.tsx` | Controlled textarea with label and char count |
| `components/ui/Card.tsx` | Container with optional title slot and padding variants |
| `components/ui/Badge.tsx` | Status pill — variants map to queue statuses and urgency levels |
| `components/ui/Spinner.tsx` | Loading spinner — three sizes, accessible aria-label |
| `components/ui/Modal.tsx` | Accessible dialog wrapper for confirmations (e.g. delete doctor) |
| `components/ui/Toast.tsx` | Toast notification — variants: success, warning, error, info; auto-dismisses |
| `components/ui/ToastProvider.tsx` | Context provider that manages the toast stack; renders `<Toast>` items |

### 1.4 Components — Layout

```
src/components/layout/
```

| File | Purpose |
|---|---|
| `components/layout/PatientNav.tsx` | Top nav for patient group — logo, "My Token" link, logout |
| `components/layout/DoctorNav.tsx` | Top nav for doctor group — logo, doctor name, session status indicator, logout |
| `components/layout/AdminNav.tsx` | Top nav for admin group — logo, section links, logout |
| `components/layout/PublicNav.tsx` | Top nav for landing page — logo, Login and Register links |

### 1.5 Components — Queue

```
src/components/queue/
```

| File | Purpose |
|---|---|
| `components/queue/TokenCard.tsx` | Displays patient's own token number, status badge, and position in queue |
| `components/queue/QueueList.tsx` | Ordered list of waiting patients for the doctor view; highlights next-up row |
| `components/queue/StatusBadge.tsx` | Maps `queue_entries.status` to a styled `<Badge>` with colour and label |
| `components/queue/WaitEstimate.tsx` | Displays estimated wait time with a subtle countdown feel |

### 1.6 Components — Doctor

```
src/components/doctor/
```

| File | Purpose |
|---|---|
| `components/doctor/LiveToggle.tsx` | Toggle button that PATCHes `doctors.is_live`; shows session duration when live |
| `components/doctor/PatientPanel.tsx` | Current patient detail card — token, name, booked time, symptoms if available |
| `components/doctor/ActionBar.tsx` | "Call Next", "Done", "Skip", "No-show" buttons with disabled states and guard logic |
| `components/doctor/SessionStats.tsx` | Live served/skipped counter bar shown below the doctor header |

### 1.7 Components — Admin

```
src/components/admin/
```

| File | Purpose |
|---|---|
| `components/admin/DoctorTable.tsx` | Table of all doctors with live badge, stats, toggle, and delete action |
| `components/admin/AddDoctorForm.tsx` | Inline form to add a doctor (name + specialty); POST to /api/doctors |
| `components/admin/StatsRow.tsx` | Row of KPI cards: tokens today, completed, active queues, avg wait |
| `components/admin/QueueOverview.tsx` | Per-doctor mini-queue showing waiting count and current patient |
| `components/admin/ActivityFeed.tsx` | Paginated, filterable list of `activity_log` rows; subscribes to Realtime |

### 1.8 Components — Symptom Checker

```
src/components/symptom/
```

| File | Purpose |
|---|---|
| `components/symptom/SymptomForm.tsx` | Age, duration, textarea, and pill chips; controlled form state |
| `components/symptom/SymptomResult.tsx` | Renders structured AI result: urgency banner, condition, advice, disclaimer |
| `components/symptom/DoctorRecommendations.tsx` | Filtered doctor list matching recommended specialty; "Book" button per row |

### 1.9 Lib — Supabase Clients

```
src/lib/supabase/
```

| File | Purpose |
|---|---|
| `lib/supabase/client.ts` | `createBrowserClient()` — used in `"use client"` components and hooks |
| `lib/supabase/server.ts` | `createServerClient()` — used in Server Components and API routes (reads cookies) |

### 1.10 Lib — Third-party Clients

```
src/lib/
```

| File | Purpose |
|---|---|
| `lib/stripe.ts` | Initialises the Stripe SDK server-side; exports `stripe` instance and `constructEvent` helper |
| `lib/openai.ts` | Initialises the OpenAI SDK; exports `openai` instance and `parseSymptomResponse()` helper |
| `lib/posthog.ts` | Initialises PostHog browser client; exports `posthog` and typed `trackEvent()` wrapper |
| `lib/sentry.ts` | Re-exports Sentry config for Next.js (sentry.client.config.ts and sentry.server.config.ts are at root) |
| `lib/utils.ts` | Shared helpers: `formatWait()`, `maskName()`, `tokenLabel()`, `cn()` (classname merge) |

### 1.11 Lib — Business Logic

```
src/lib/
```

| File | Purpose |
|---|---|
| `lib/queue.ts` | Server-side queue operations: `issueToken()`, `advanceQueue()`, `computeWait()` — called by API routes |
| `lib/auth.ts` | Server-side auth helpers: `getSessionUser()`, `requireRole()`, `createPatientRecord()` |

### 1.12 Hooks

```
src/hooks/
```

| File | Purpose |
|---|---|
| `hooks/useQueue.ts` | Subscribes to `queue_entries` Realtime channel; returns live queue array and loading state |
| `hooks/useUser.ts` | Returns current Supabase Auth user, role from `user_metadata`, and `signOut()` |
| `hooks/useToast.ts` | Consumes `ToastProvider` context; returns `toast.success()`, `toast.error()` etc. |
| `hooks/useDoctors.ts` | Fetches live doctors list; used on patient booking form and symptom checker |

### 1.13 Types

```
src/types/
```

| File | Purpose |
|---|---|
| `types/database.ts` | Supabase generated types (run `supabase gen types typescript`); re-exported as `DB` |
| `types/index.ts` | App-level types: `QueueEntry`, `Doctor`, `Patient`, `ActivityLog`, `SymptomResult`, `UserRole` |

### 1.14 Middleware

| File | Purpose |
|---|---|
| `middleware.ts` | Intercepts all requests; refreshes Supabase session cookie; enforces role-based redirects |

### 1.15 Root Config (Sentry — lives at project root, not src/)

| File | Purpose |
|---|---|
| `sentry.client.config.ts` | Sentry browser init — dsn, tracing, replay |
| `sentry.server.config.ts` | Sentry server init — dsn, tracing |
| `sentry.edge.config.ts` | Sentry edge runtime init |

---

## 2. Build Order

Dependencies flow downward. Never start a step until every step it depends on is complete.

```
Step  1 ── types/index.ts + types/database.ts
             No deps. Everything else imports from here.

Step  2 ── lib/supabase/client.ts + lib/supabase/server.ts
             Depends on: Step 1 (types)

Step  3 ── lib/auth.ts + middleware.ts
             Depends on: Step 2 (Supabase clients)
             Gate: All protected routes require auth. Build this before any page.

Step  4 ── lib/utils.ts
             No deps. Pure helpers, no external imports.

Step  5 ── components/ui/*  (all 10 primitives)
             Depends on: Step 4 (utils for cn())
             Gate: Every other component imports from here.

Step  6 ── components/layout/*  (4 nav components)
             Depends on: Step 5 (UI primitives), Step 3 (useUser via hook)

Step  7 ── hooks/useUser.ts + hooks/useToast.ts
             Depends on: Step 2 (Supabase client), Step 5 (Toast UI)

Step  8 ── components/ui/ToastProvider.tsx
             Depends on: Step 5 (Toast), Step 7 (useToast)

Step  9 ── app/layout.tsx  (root layout)
             Depends on: Steps 6, 8 (nav + toast provider); Sentry + PostHog init
             Gate: All pages render inside this layout.

Step 10 ── app/(auth)/login/page.tsx + register/page.tsx
             Depends on: Steps 3, 5, 9 (auth lib, UI, root layout)
             Gate: Every authenticated page redirect-loops without a working login.

Step 11 ── lib/queue.ts
             Depends on: Steps 1, 2 (types, Supabase server client)
             Gate: All token/queue API routes call functions from here.

Step 12 ── app/api/doctors/route.ts
             Depends on: Steps 2, 3, 11 (Supabase, auth, queue lib)
             Gate: Patient booking form needs live doctor list.

Step 13 ── app/api/tokens/route.ts
             Depends on: Steps 2, 3, 11, 12 (Supabase, auth, queue, doctors exist)

Step 14 ── app/api/queue/route.ts
             Depends on: Steps 2, 3, 11

Step 15 ── lib/openai.ts + app/api/ai/symptom-check/route.ts
             Depends on: Steps 2, 3 (Supabase for logging, auth)

Step 16 ── lib/stripe.ts + app/api/webhooks/stripe/route.ts
             Depends on: Steps 2, 3 (Supabase for recording events, auth)

Step 17 ── hooks/useQueue.ts + hooks/useDoctors.ts
             Depends on: Steps 1, 2 (types, Supabase realtime client)

Step 18 ── components/queue/*  (4 components)
             Depends on: Steps 5, 1 (UI primitives, types)

Step 19 ── app/(patient)/patient/page.tsx
             Depends on: Steps 3, 10, 12, 13, 14, 17, 18
             (auth, login exists, doctor API, token API, queue API, hooks, queue components)

Step 20 ── components/symptom/*  (3 components)
             Depends on: Steps 5, 1, 12 (UI, types, doctors API)

Step 21 ── app/(patient)/symptom-check/page.tsx
             Depends on: Steps 15, 19, 20 (AI API, patient page exists, symptom components)

Step 22 ── components/doctor/*  (4 components)
             Depends on: Steps 5, 17, 18 (UI, hooks, queue components)

Step 23 ── app/(doctor)/doctor/page.tsx
             Depends on: Steps 3, 10, 12, 14, 17, 22
             (auth, login, doctors API, queue API, hooks, doctor components)

Step 24 ── components/admin/*  (5 components)
             Depends on: Steps 5, 17, 18 (UI, hooks, queue components)

Step 25 ── app/(admin)/admin/page.tsx
             Depends on: Steps 3, 10, 12, 14, 24
             (auth, login, doctors API, queue API, admin components)

Step 26 ── app/page.tsx  (landing)
             Depends on: Steps 5, 6, 9 (UI, nav, root layout)
             Note: Build last — it needs real queue stats to display meaningfully.

Step 27 ── lib/posthog.ts — instrument PostHog events across all pages
             Depends on: All pages exist (Steps 19–26)

Step 28 ── sentry.*.config.ts — wire Sentry into root layout and API routes
             Depends on: Step 9 (root layout), Steps 12–16 (all API routes)

Step 29 ── End-to-end test pass: golden path for each role
             Depends on: All steps above complete.
```

---

## 3. Component Tree

### 3.1 Shared Components (used across 2+ pages)

```
Shared
├── UI Primitives (used everywhere)
│   ├── Button
│   ├── Input
│   ├── Select
│   ├── Textarea
│   ├── Card
│   ├── Badge
│   ├── Spinner
│   ├── Modal
│   ├── Toast
│   └── ToastProvider
│
├── Layout
│   └── (each nav is shared within its role group)
│       PatientNav ── /patient, /symptom-check
│       DoctorNav  ── /doctor
│       AdminNav   ── /admin
│       PublicNav  ── /
│
├── Queue
│   ├── StatusBadge ── /patient, /doctor, /admin
│   └── WaitEstimate ── /patient, /doctor
│
└── Hooks
    ├── useUser     ── all authenticated pages
    ├── useToast    ── all pages
    ├── useQueue    ── /patient, /doctor, /admin
    └── useDoctors  ── /patient, /symptom-check
```

### 3.2 Page-Specific Components

```
/patient
├── TokenCard           (only here)
├── QueueList           (shared with /doctor — different props)
└── BookingForm         (inline in page — simple enough, no separate file)

/symptom-check
├── SymptomForm         (only here)
├── SymptomResult       (only here)
└── DoctorRecommendations (only here, but calls useDoctors shared hook)

/doctor
├── LiveToggle          (only here)
├── PatientPanel        (only here)
├── ActionBar           (only here)
├── SessionStats        (only here)
└── QueueList           (shared with /patient — doctor variant prop)

/admin
├── DoctorTable         (only here)
├── AddDoctorForm       (only here)
├── StatsRow            (only here)
├── QueueOverview       (only here)
└── ActivityFeed        (only here)
```

---

## 4. API Routes — Full Table

| Method | Path | Auth Required | Role(s) | Reads | Writes | Notes |
|---|---|---|---|---|---|---|
| GET | `/api/doctors` | Yes | patient, doctor, admin | `doctors` | — | Returns all; filtered to `is_live=true` when query param `?live=true` |
| POST | `/api/doctors` | Yes | admin | — | `doctors`, `activity_log` | Creates doctor; name + specialty required |
| PATCH | `/api/doctors` | Yes | doctor, admin | `doctors` | `doctors`, `activity_log` | Updates `is_live` (doctor self), or any field (admin) |
| DELETE | `/api/doctors` | Yes | admin | `doctors` | `doctors`, `activity_log` | Hard deletes if `served_count = 0`; otherwise deactivates |
| GET | `/api/queue` | Yes | patient, doctor, admin | `queue_entries`, `patients` | — | `?doctorId=` required; `?status=waiting` optional filter |
| POST | `/api/queue` | Yes | patient, admin | — | `queue_entries`, `activity_log` | Creates entry; calls `issueToken()` from `lib/queue.ts` |
| PATCH | `/api/queue` | Yes | doctor, admin | `queue_entries` | `queue_entries`, `doctors`, `activity_log` | Updates `status`; increments `served_count` or `skipped_count` on doctor row |
| POST | `/api/tokens` | Yes | patient, admin | `patients`, `doctors` | `patients`, `queue_entries`, `activity_log` | Full token issuance: upsert patient, get next token, insert queue entry |
| POST | `/api/ai/symptom-check` | Yes | patient, admin | `doctors` | `activity_log` | Calls GPT-4o-mini; parses structured response; logs event; returns `SymptomResult` |
| POST | `/api/webhooks/stripe` | No (Stripe sig) | — | — | `activity_log` | Verifies webhook signature; records payment events; idempotent on event id |
| GET | `/api/auth/confirm` | No | — | — | — | Exchanges Supabase `code` param for session cookie; redirects to `/patient` |

### Request / Response Shapes

#### POST /api/tokens
```ts
// Request
{ doctorId: string; name: string; phone: string; symptoms?: string }

// Response 200
{ tokenNumber: number; tokenLabel: string; queueEntryId: string;
  position: number; estimatedWait: number }

// Response 400
{ error: string }
```

#### POST /api/ai/symptom-check
```ts
// Request
{ symptoms: string; age: number; duration: string }

// Response 200
{ urgency: 'low' | 'medium' | 'high' | 'critical';
  possibleCondition: string;
  recommendedSpecialty: string;
  advice: string;
  disclaimer: string;
  matchingDoctors: Doctor[] }

// Response 400 / 500
{ error: string; message: string }
```

#### PATCH /api/queue
```ts
// Request
{ id: string; status: 'called' | 'serving' | 'done' | 'skipped' | 'cancelled' }

// Response 200
{ updated: QueueEntry }
```

---

## 5. Supabase Realtime Plan

### Tables That Need Live Subscriptions

| Table | Subscribed On | Used By | Channel Name | Filter |
|---|---|---|---|---|
| `queue_entries` | INSERT, UPDATE | `/patient` (own position), `/doctor` (their queue), `/admin` (overview) | `queue:doctor:{doctorId}` | `doctor_id=eq.{doctorId}` |
| `activity_log` | INSERT | `/admin` (activity feed) | `activity_log:all` | none |
| `doctors` | UPDATE | `/patient` (doctor live status on booking form) | `doctors:live` | `is_live=eq.true` |

### Implementation Pattern

All Realtime logic lives in `hooks/useQueue.ts` and `hooks/useDoctors.ts`.
Pages never subscribe directly — they call hooks.

```
useQueue(doctorId: string) → {
  entries: QueueEntry[]   // live-updating array
  loading: boolean
  error: string | null
}
```

Subscription lifecycle:
1. Hook mounts → `supabase.channel(name).on('postgres_changes', ...).subscribe()`
2. On INSERT: append new entry to local array
3. On UPDATE: replace matching entry in local array by `id`
4. Hook unmounts → `supabase.removeChannel(channel)`

### What Does NOT Use Realtime

- Doctor list on the patient booking form (`useDoctors`) — fetches once on mount,
  refetches when component regains focus. Doctors don't change frequently enough
  to warrant a socket.
- Admin stats row — refetches every 30 seconds via `setInterval`. Not worth a
  Realtime channel for aggregate counts.
- Symptom checker — one-shot fetch, no subscription needed.

---

## 6. State Management Decision

### Decision Matrix

| Data | Where It Lives | Why |
|---|---|---|
| Authenticated user + role | Supabase Auth session (cookie) → `useUser` hook | Auth state must survive page refresh; cookies are the right primitive |
| Live queue entries for a doctor | Supabase Realtime in `useQueue` hook | Must update for all connected clients instantly; local React state would diverge |
| List of live doctors | `useDoctors` hook (fetch + refetch) | Changes infrequently; full Realtime subscription is overkill |
| Activity log (admin) | Supabase Realtime in `ActivityFeed` component | Admin needs live audit trail; INSERT-only so no conflict resolution needed |
| Symptom form input | Local `useState` in `SymptomForm` | Pure UI state, never needs to be shared or persisted mid-session |
| Symptom analysis result | Local `useState` in symptom-check page | One-shot result; disappears on navigate away, which is correct behaviour |
| Doctor session status (is_live) | Supabase DB → Realtime UPDATE | Must be consistent across all clients; doctor toggling live status must update patient booking form |
| Toast notifications | React context in `ToastProvider` | UI-only, ephemeral, scoped to the session; no persistence needed |
| Current patient being served | Supabase DB → `useQueue` Realtime | Derived from `queue_entries` where `status = 'serving'`; no separate state needed |
| Admin stats (totals) | Server Component fetch + 30s client refetch | Aggregate queries are expensive; realtime is not worth the cost for counts |
| Booking form fields (name, phone) | Local `useState` | Form-local UI state; submitted then discarded |
| Modal open/close state | Local `useState` in parent component | Pure UI state; never shared |

### Server Component vs Client Component Decision

```
Server Components (default — no "use client"):
  app/(auth)/login/page.tsx         — static form shell, no interactivity at page level
  app/(auth)/register/page.tsx      — same
  app/page.tsx                      — landing stats fetched server-side
  app/(admin)/admin/page.tsx        — initial data fetched server-side; children are client

Client Components ("use client" required):
  components/queue/QueueList.tsx    — subscribes to Realtime
  components/queue/TokenCard.tsx    — shows live status updates
  components/doctor/LiveToggle.tsx  — user interaction + optimistic UI
  components/doctor/ActionBar.tsx   — user interaction
  components/doctor/PatientPanel.tsx — reads from Realtime queue state
  components/admin/ActivityFeed.tsx — subscribes to Realtime
  components/admin/DoctorTable.tsx  — user interaction (toggle, delete)
  components/symptom/SymptomForm.tsx — controlled form
  components/symptom/SymptomResult.tsx — renders after async fetch
  All hooks (useQueue, useUser, etc.) — hooks require client context
  ToastProvider                     — context requires client
```

### No External State Library

Redux, Zustand, and Jotai are not needed. Reasons:
- Supabase Realtime handles all cross-client sync
- Auth state is managed by Supabase session
- The only global UI state is toasts, handled by a single React context
- Each page's data is scoped enough to live in its own hook or Server Component

---

## 7. Feature Complexity Estimates

### Infrastructure

| Feature | Complexity | Notes |
|---|---|---|
| Supabase client setup (client + server) | Low | Boilerplate; well-documented |
| `middleware.ts` auth + RBAC routing | Medium | Session refresh + role check in one pass; edge runtime constraints |
| Root layout with Sentry + PostHog | Low | Init calls; no logic |
| Type generation (`supabase gen types`) | Low | CLI command; no manual work |

### Auth

| Feature | Complexity | Notes |
|---|---|---|
| Login page + Supabase `signInWithPassword` | Low | Standard flow |
| Role-based redirect after login | Medium | Must read `user_metadata.role`, handle stale sessions |
| Register page + create patient row | Medium | Two operations (Auth + DB insert) must be atomic; handle partial failure |
| Email confirmation redirect handler | Low | Exchange code for session; one route |
| Password reset flow | Low | Supabase handles the email; just the UI form |

### API Routes

| Feature | Complexity | Notes |
|---|---|---|
| GET /api/doctors | Low | Simple select |
| POST /api/doctors | Low | Insert + activity log |
| PATCH /api/doctors (is_live toggle) | Low | Single field update |
| DELETE /api/doctors | Medium | Guard: check served_count, cascade vs deactivate decision |
| GET /api/queue | Low | Select with filter |
| POST /api/queue | Medium | Must call `next_token_number()`, handle race edge case |
| PATCH /api/queue (status transitions) | Medium | Must enforce valid state transitions; update doctor counters |
| POST /api/tokens | High | Multi-step: upsert patient, next token, insert queue entry, log activity; must be transactional |
| POST /api/ai/symptom-check | High | Prompt engineering, structured JSON parse, specialty matching, error handling for OpenAI failures |
| POST /api/webhooks/stripe | High | Signature verification, idempotency check, event routing; no second chances on failure |

### Pages

| Feature | Complexity | Notes |
|---|---|---|
| Landing page (`/`) | Low | Static with one server-side stats fetch |
| Login / Register pages | Medium | Form validation, error states, redirect logic |
| Patient portal (`/patient`) | High | Realtime subscription, booking flow, own token status, live position |
| Symptom checker (`/symptom-check`) | Medium | Form + async AI call + structured display; no Realtime needed |
| Doctor dashboard (`/doctor`) | High | Realtime queue, session management, three action states, guard logic for invalid transitions |
| Admin panel (`/admin`) | High | Most data surfaces (CRUD table, stats, overview, activity feed + Realtime) |

### Components

| Feature | Complexity | Notes |
|---|---|---|
| All UI primitives (Button through Modal) | Low | Each is a single styled wrapper |
| ToastProvider + useToast | Low | Simple context pattern |
| TokenCard | Low | Display component; reads from hook |
| QueueList | Medium | Realtime-connected; must handle empty, loading, and error states |
| StatusBadge | Low | Pure mapping function |
| WaitEstimate | Low | Format helper + display |
| LiveToggle | Medium | Optimistic UI — must show change instantly before DB confirms |
| PatientPanel | Low | Display-only from queue state |
| ActionBar | Medium | Disabled states + guard logic (cannot call next if serving; cannot skip if no active patient) |
| SessionStats | Low | Derived from doctor row |
| DoctorTable | Medium | Inline toggle + delete with confirmation modal |
| AddDoctorForm | Low | Simple POST form |
| StatsRow | Low | Four KPI cards with computed values |
| QueueOverview | Medium | Per-doctor summary with Realtime queue counts |
| ActivityFeed | Medium | Paginated + Realtime INSERT subscription + type filter |
| SymptomForm | Low | Controlled form; pill chips are simple toggle logic |
| SymptomResult | Medium | Urgency colour logic; conditional rendering for each field |
| DoctorRecommendations | Medium | Filter doctors by recommended specialty; handle empty match |

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `next_token_number()` race condition under concurrent bookings | Low | High | Wrap in a Postgres transaction; add a unique constraint that catches duplicates |
| OpenAI response not parseable as structured JSON | Medium | Medium | Always parse inside try/catch; fall back to displaying raw text with a warning |
| Supabase Realtime disconnects silently | Medium | High | Subscribe with `{ event: 'system', ... }` to detect disconnects; show "reconnecting" banner |
| Stripe webhook delivered twice (duplicate event) | Low | High | Store `stripe_event_id` in `activity_log`; check before processing |
| `user_metadata.role` missing for legacy users | Low | High | `requireRole()` in `lib/auth.ts` must handle `undefined` role and redirect to `/login` |
| Next.js 16 breaking changes vs training data | High | Medium | Always `use context7` before implementing any Next.js API; AGENTS.md already warns about this |
| Admin deletes a doctor who has active queue entries | Low | High | Block delete if any entry for that doctor has status `waiting`, `called`, or `serving` |

---

## 9. Build Checklist (Gate Conditions)

Each gate must pass before moving to the next build step.

```
[ ] Step 1–4   Complete when: types compile cleanly; Supabase clients connect;
               middleware redirects unauthenticated requests to /login.

[ ] Step 5–9   Complete when: all UI primitives render in isolation;
               root layout wraps a test page without errors.

[ ] Step 10    Complete when: can register a new patient, receive confirmation email,
               log in, and be redirected to /patient (empty state is fine).

[ ] Step 11–16 Complete when: all API routes return correct shapes in a REST client
               (Postman / curl); auth guards reject wrong roles with 403.

[ ] Step 17–21 Complete when: patient can book a token end-to-end; token appears in
               Supabase; queue position updates in real-time on a second browser tab.

[ ] Step 22–23 Complete when: doctor can log in, toggle live, see the queue,
               call next, mark done, skip — all reflected in Supabase instantly.

[ ] Step 24–25 Complete when: admin can add/delete doctors, see all queues,
               and read the live activity feed.

[ ] Step 26–28 Complete when: landing page shows real stats; Sentry captures a
               test error; PostHog records a "token_booked" event.

[ ] Step 29    Complete when: end-to-end test passes for all three roles
               without any console errors or Sentry alerts.
```
