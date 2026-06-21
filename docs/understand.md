# MediQueue v2 — Understand Phase

> Produced: 2026-06-21  
> Sources read: CLAUDE.md, package.json, migration SQL, architecture.md,
> frontend/src/App.jsx, frontend/src/SymptomChecker.jsx,
> backend/ApiController.java, backend/InMemoryStore.java  
> Status: Analysis only — no feature code written.

---

## 1. Every Feature That Exists in the Legacy App

### 1.1 Patient Tab
| # | Feature | Where |
|---|---|---|
| 1 | Book a queue token by entering name, selecting a doctor, and optionally a phone number | `App.jsx → bookToken()` |
| 2 | View the live queue list (all non-done entries) | `App.jsx → patientVisible` filter |
| 3 | See your own token number and estimated wait time after booking | `App.jsx → state.myToken` |
| 4 | Toast notifications on booking success / failure | `App.jsx → notify()` |

### 1.2 Symptom Checker Tab
| # | Feature | Where |
|---|---|---|
| 5 | Enter age, duration, and free-text symptoms | `SymptomChecker.jsx` |
| 6 | One-click pill buttons for 15 common symptoms | `SymptomChecker.jsx → commonSymptoms` |
| 7 | POST symptoms to backend → receive AI analysis text | `SymptomChecker.jsx → handleCheckSymptoms()` |
| 8 | Display raw AI analysis text + disclaimer | `SymptomChecker.jsx → result` |
| 9 | Display recommended doctors from store and allow selecting one | `SymptomChecker.jsx → handleSelectRecommendedDoctor()` |
| 10 | Selecting a doctor navigates to the Patient tab | `App.jsx → handleSelectDoctorFromSymptom()` |

### 1.3 Doctor Tab
| # | Feature | Where |
|---|---|---|
| 11 | Start / End session toggle (go online / offline) | `App.jsx → toggleSession()` |
| 12 | Call next waiting patient → marks them `active` | `App.jsx → docCallNext()` |
| 13 | Mark current patient as done → increments served count | `App.jsx → docDone()` |
| 14 | Skip current patient → sends them to back of queue | `App.jsx → docSkip()` |
| 15 | View waiting queue list with position and estimated wait | `App.jsx → doctor tab render` |
| 16 | Hardcoded doctor identity — always "Dr. Priya Mehta" | `App.jsx → doctor tab header` |

### 1.4 Admin Tab
| # | Feature | Where |
|---|---|---|
| 17 | Stats panel: total tokens issued, completed count, avg wait (hardcoded 18m) | `App.jsx → admin tab` |
| 18 | Doctor list with live/offline badge | `App.jsx → state.doctors.map` |
| 19 | Horizontal bar chart of tokens served per doctor | `App.jsx → admin tab` |
| 20 | Activity log (last 20 events) shown in sidebar | `App.jsx → state.activityLog` |

### 1.5 Backend Endpoints (Spring Boot)
| # | Feature | Where |
|---|---|---|
| 21 | GET /api/info — health check | `ApiController.java` |
| 22 | GET /api/queue/live/:doctorId — live queue (ignores doctorId, returns all) | `ApiController.java` |
| 23 | GET /api/queue/stats — waiting count, now-serving token, avg wait | `ApiController.java` |
| 24 | POST /api/tokens/book — issue a new token | `ApiController.java` |
| 25 | GET /api/doctor/queue — fetch waiting entries only | `ApiController.java` |
| 26 | POST /api/doctor/queue/callNext — mark active done, promote next waiting | `ApiController.java` |
| 27 | GET /api/admin/doctors — list all doctors | `ApiController.java` |
| 28 | POST /api/admin/doctors — add a new doctor | `ApiController.java` |
| 29 | POST /api/ai/symptom-check — call GPT-4o-mini with prompt, return analysis | `ApiController.java` |

---

## 2. Every Legacy API Endpoint — What It Does and What It Returns

### GET /api/info
- **Purpose:** Health check
- **Returns:** `{ name: "Clinic App", version: "0.1" }`
- **Notes:** No auth. Purely diagnostic.

### GET /api/queue/live/:doctorId
- **Purpose:** Fetch the live queue
- **Returns:** Full `store.queue` list (all statuses)
- **Bug:** Ignores the `doctorId` path variable — returns every entry regardless of doctor.
  In a multi-doctor clinic this leaks cross-doctor data.

### GET /api/queue/stats
- **Purpose:** Summary stats for the lobby display
- **Returns:** `{ inQueue, nowServing, avgWait }`
- **Notes:** `avgWait` is computed as `waitingCount * 8` minutes. The 8-minute
  constant is hardcoded — no real measurement of consultation duration.

### POST /api/tokens/book
- **Purpose:** Issue a new queue token
- **Body:** `{ name, doctor }` — phone is accepted by the frontend but not sent
  to this endpoint (it is silently dropped)
- **Returns:** `{ status: "ok", token: { id, token, name, status, wait, bookedAt } }`
- **Bug:** Token is stored in memory only. Restart = all data lost.
- **Bug:** `doctor` field is stored as a raw string (e.g. "dr1") with no
  validation that the doctor exists or is live.

### GET /api/doctor/queue
- **Purpose:** Fetch only waiting entries for the doctor panel
- **Returns:** Array of waiting queue entries
- **Notes:** No doctor identity — returns all waiting entries system-wide.

### POST /api/doctor/queue/callNext
- **Purpose:** Promote next waiting patient to active
- **Returns:** `{ status: "called", token: {...} }` or `{ status: "empty" }`
- **Notes:** Marks previous active entry as done automatically. No way to
  distinguish between "done" and "skipped" in the backend — both transitions
  produce `status: "done"`.

### GET /api/admin/doctors
- **Purpose:** List all registered doctors
- **Returns:** Array of doctor objects `{ id, name, spec, live, served, skipped }`
- **Notes:** No auth guard — publicly accessible.

### POST /api/admin/doctors
- **Purpose:** Add a new doctor
- **Body:** `{ name, spec }`
- **Returns:** `{ status: "ok", doctor: {...} }`
- **Notes:** No auth guard. No delete endpoint — doctors can be added but never
  removed via API.

### POST /api/ai/symptom-check
- **Purpose:** Send symptom data to OpenAI and return analysis
- **Body:** `{ symptoms, age, duration }`
- **Returns:** `{ status: "ok", analysis: <raw GPT response string>, disclaimer, doctors: [...] }`
- **Bugs:**
  - Returns the entire raw OpenAI JSON response string as `analysis`, not the
    extracted message content. Frontend slices it at 500 chars.
  - Returns all doctors from the store regardless of specialty match —
    no filtering based on AI-recommended department.
  - No rate limiting or abuse protection.

---

## 3. Every Data Model — Legacy vs v2 Target

### 3.1 Queue Entry

| Field | Legacy (InMemory) | v2 (Supabase) | Notes |
|---|---|---|---|
| id | `System.currentTimeMillis()` integer | `uuid` | Type-safe PK |
| token | `"T-007"` string | `token_number` integer | v2 stores the number, formats on display |
| name | inline string | via `patient_id` FK → `patients.name` | Normalised |
| status | `waiting / active / done` | `waiting / called / serving / done / skipped / cancelled` | 3 → 6 states |
| wait | computed int (minutes) | `wait_minutes` integer | Stored, not computed each time |
| bookedAt | `LocalTime` string | `timestamptz` | Timezone-aware |
| doctor | raw string `"dr1"` | `doctor_id` UUID FK | Enforced FK |
| phone | not stored | via `patients.phone` | Now persisted |

### 3.2 Doctor

| Field | Legacy | v2 | Notes |
|---|---|---|---|
| id | `"dr1"` string | `uuid` | Type-safe |
| name | text | text | Same |
| spec | text | specialty text | Renamed for clarity |
| live | boolean | `is_live` boolean | Renamed |
| served | integer | `served_count` integer | Renamed |
| skipped | integer | `skipped_count` integer | Renamed |
| created_at | not tracked | `timestamptz` | Added |

### 3.3 Patient
| Field | Legacy | v2 | Notes |
|---|---|---|---|
| — | Not a model — name/phone embedded in token | `id, name, phone, created_at` | Now a first-class entity |

The legacy app conflates patient identity with queue entry. v2 separates them
so one patient can appear in multiple queue entries across visits.

### 3.4 Activity Log

| Field | Legacy | v2 | Notes |
|---|---|---|---|
| time | `LocalTime` string e.g. `"10:41"` | `created_at timestamptz` | Full timestamp |
| msg | text | `message` text | Renamed |
| type | `"blue" / "green" / "amber" / "purple"` | `"info" / "success" / "warning" / "error"` | Semantic values, not colours |
| id | not present | `uuid` | Added for idempotency |

---

## 4. Gaps — What the Legacy App Is Missing That v2 Must Add

### 4.1 Authentication & Identity — Critical Gap
- **Legacy:** No auth whatsoever. Any browser can call any endpoint. The doctor
  panel is a tab anyone can click. The admin panel is a tab anyone can click.
- **v2 must add:** Supabase Auth with three roles: `patient`, `doctor`, `admin`.
  `middleware.ts` must guard every protected route.

### 4.2 Persistence — Critical Gap
- **Legacy:** `InMemoryStore` — all data vanishes on server restart. The
  frontend keeps its own duplicate copy in React state.
- **v2 must add:** Supabase Postgres. All four tables are already designed with
  proper FK constraints, RLS, and indexes.

### 4.3 Multi-Doctor Queue Isolation
- **Legacy:** One global queue shared across all doctors. `/api/queue/live/:doctorId`
  ignores its own parameter.
- **v2 must add:** Every queue entry is keyed to a `doctor_id`. Queries always
  filter by doctor. A doctor sees only their own queue.

### 4.4 Real-time Queue Updates
- **Legacy:** No live updates. The frontend never re-fetches — state is mutated
  locally only. If two tabs are open they diverge immediately.
- **v2 must add:** Supabase Realtime subscription on `queue_entries` so the
  doctor dashboard and patient status screen update without polling.

### 4.5 Doctor Self-Management
- **Legacy:** Doctor identity is hardcoded as "Dr. Priya Mehta". There is no
  login, so the app pretends a single doctor owns the session.
- **v2 must add:** Each doctor logs in with their own Supabase Auth account.
  The doctor dashboard shows their own queue only.

### 4.6 Structured AI Response
- **Legacy:** Returns the raw OpenAI JSON response string. The frontend
  truncates it at 500 characters. No priority level, no specialty routing.
- **v2 must add:** Parse the GPT response into a structured object:
  `{ urgency, possibleCondition, recommendedSpecialty, advice }`.
  Use this to filter the doctor list to the matching specialty.

### 4.7 Skip vs Done Distinction
- **Legacy:** Skip sends the patient to the back of the queue client-side, but
  the backend `callNext` marks the previous entry as `done` regardless —
  it cannot distinguish a skip from a completion.
- **v2 must add:** Separate `status` values: `skipped` keeps the entry in the
  queue (re-queued), `done` closes it. `skipped_count` on the doctor row is
  incremented only on genuine skips.

### 4.8 Token Number Uniqueness
- **Legacy:** `tokenCounter` starts at 7 (hardcoded seed data) and increments
  globally. Two concurrent bookings could race and produce the same token.
- **v2 must add:** `next_token_number(doctor_id)` SQL function scoped per
  doctor per day, called inside a transaction to prevent races.

### 4.9 Phone Number Persistence
- **Legacy:** Phone is collected in the BookForm but never sent to the backend
  (`bookToken()` in App.jsx ignores the phone argument in the API call).
- **v2 must add:** Phone stored on the `patients` table and searchable.

### 4.10 Admin Doctor Management (Delete)
- **Legacy:** Admin can add doctors via POST but there is no delete endpoint.
  Doctors accumulate forever.
- **v2 must add:** DELETE /api/doctors with admin-only guard.

### 4.11 Payments / Stripe
- **Legacy:** No payment concept at all.
- **v2 must add:** Stripe payment intent for token booking (consultation fee).
  Webhook handler at `/api/webhooks/stripe` for `payment_intent.succeeded`
  to confirm the booking.

### 4.12 Error Tracking & Observability
- **Legacy:** `console.error` only. No production error capture.
- **v2 must add:** `@sentry/nextjs` wired into the root layout and all API
  routes. Errors captured with context (user id, route, request body shape).

### 4.13 Analytics
- **Legacy:** No analytics.
- **v2 must add:** PostHog events for: token booked, symptom check run, doctor
  called next, session started/ended, payment completed.

### 4.14 Avg Wait Time — Real Measurement
- **Legacy:** Hardcoded `waitingCount * 8`. Never updated. Admin shows a static "18m".
- **v2 must add:** Compute real average from `(done_at - booked_at)` across
  completed entries. Store `wait_minutes` on completion.

---

## 5. User Roles and What Each Role Can Do

### Role: `patient`
Assigned at registration. Represents a clinic visitor.

| Can Do | Cannot Do |
|---|---|
| Register and log in | Access /doctor or /admin |
| Book a queue token for a specific doctor | Call next patient |
| Check own token status and queue position | Add or remove doctors |
| Run the AI symptom checker | View other patients' details |
| See the live queue (own doctor only) | Manage any system state |
| Pay consultation fee via Stripe | — |

### Role: `doctor`
Created by an admin. Each doctor has one Supabase Auth account.

| Can Do | Cannot Do |
|---|---|
| Log in and view own dashboard | Access /admin |
| Toggle is_live (start/end session) | Add or remove other doctors |
| See their own queue of waiting patients | Book tokens |
| Call next patient (waiting → called → serving) | Run symptom checker |
| Mark patient as done (serving → done) | View other doctors' queues |
| Skip patient (serving → skipped → re-queued) | — |
| See their own served/skipped counts | — |

### Role: `admin`
Single super-user or clinic manager account.

| Can Do | Cannot Do |
|---|---|
| Access all three role areas | — |
| Add new doctors to the system | — |
| Remove / deactivate doctors | — |
| View all queues across all doctors | — |
| View activity log | — |
| See clinic-wide stats (tokens, completions, avg wait) | — |
| Override queue entries (cancel tokens) | — |

### Role: `unauthenticated` (public)
| Can Do | Cannot Do |
|---|---|
| View landing page / | Access any protected route |
| Register as a patient | — |
| Log in | — |

---

## 6. The Six Pages We Need to Build

### Page 1: `/` — Landing Page
**Who sees it:** Everyone (public)  
**Purpose:** Clinic's front door. Must communicate what MediQueue is, drive
patients to register/login, and give doctors a login path.

**Must do:**
- Display clinic name, tagline, and value proposition
- Two clear CTAs: "Get a Token" (→ /register or /patient) and "Doctor Login" (→ /login)
- Show current wait time and number of doctors online (public, read-only stats)
- No auth required

**Must not do:**
- Show any patient names or queue data
- Require login to view

---

### Page 2: `/patient` — Patient Portal
**Who sees it:** Authenticated patients only  
**Purpose:** A patient's primary interaction screen after login. Book a token,
track their position, see queue movement.

**Must do:**
- Book a token: select a live doctor, submit name + phone (pre-filled from profile)
- Display own token number prominently once booked (`TokenCard`)
- Show live queue position and estimated wait time, updating in real-time via
  Supabase Realtime subscription
- Link to `/symptom-check` for AI triage before booking
- Show a badge when their token is called (`status = called`)
- Handle the case where no doctors are currently live

**Must not do:**
- Show other patients' names (only position numbers)
- Allow booking for an offline doctor

---

### Page 3: `/symptom-check` — AI Triage
**Who sees it:** Authenticated patients only  
**Purpose:** Help the patient describe symptoms and receive a structured AI
recommendation for which type of doctor to see.

**Must do:**
- Collect: age (number), symptom duration (select), symptoms (textarea + pill chips)
- 15 quick-pick symptom chips (from legacy app — keep this UX, it works)
- POST to `/api/ai/symptom-check` → display structured result:
  - Urgency level with colour coding (low=green, medium=amber, high/critical=red)
  - Possible condition (brief text)
  - Recommended specialty
  - Brief advice text
  - Disclaimer banner (non-negotiable — present in legacy, must stay)
- Filter and display matching live doctors for the recommended specialty
- "Book with this doctor" button → navigate to /patient with doctor pre-selected
- Loading state during API call (minimum 800ms artificial delay to feel considered,
  not instant — builds trust in a medical context)

**Must not do:**
- Present AI output as a diagnosis
- Show doctors of the wrong specialty as primary options
- Allow submission without at least one symptom entered

---

### Page 4: `/doctor` — Doctor Dashboard
**Who sees it:** Authenticated doctors only  
**Purpose:** The doctor's real-time workspace. Manage their session, call patients,
mark consultations complete.

**Must do:**
- Show doctor's name, specialty, and session status (online/offline) in the header
- `LiveToggle` — Start Session / End Session button that updates `is_live` in DB
- `QueueList` — their waiting patients in order, each showing: position, name
  masked to first name only (privacy), token number, wait time
- `CallButton` — "Call Next" advances the top of the queue from `waiting` → `called`
- Current patient panel showing: token, full name, booked time, symptoms (if
  symptom check was run)
- Three action buttons on the current patient:
  - "Done" → status `serving → done`, `served_count++`
  - "Skip" → status `serving → skipped`, re-queued at the back, `skipped_count++`
  - (implicit) "Cancel" → status → `cancelled` for no-shows
- Session stats bar: served today, skipped today, average consultation time
- Real-time updates via Supabase Realtime — queue changes without refresh

**Must not do:**
- Show another doctor's queue
- Allow calling next while a patient is already in `serving` state
- Allow ending session while a patient is in `serving` state (warn instead)

---

### Page 5: `/admin` — Admin Panel
**Who sees it:** Authenticated admins only  
**Purpose:** Clinic management. Doctor roster, system-wide queue health,
activity audit trail.

**Must do:**
- **Stats row:** Total tokens today, completed consultations, active queues,
  average wait time (real, computed from `wait_minutes`)
- **Doctor Manager:** Table of all doctors with: name, specialty, is_live status,
  served_count, skipped_count. Add doctor form (name + specialty). Delete button
  per row (with confirmation). Toggle live status from admin.
- **Queue Overview:** Per-doctor summary — how many waiting, who is currently
  being served, last activity time
- **Activity Feed:** Paginated list from `activity_log` table, filterable by
  type (info / success / warning / error), latest-first. Real-time via Realtime.
- **Bar chart:** Tokens served per doctor today (mirrors legacy feature but uses
  real data)

**Must not do:**
- Allow adding doctors without a name and specialty
- Hard-delete queue entries (only cancel)
- Show patient full names in the overview (token numbers only)

---

### Page 6: `/(auth)/login` and `/(auth)/register`
**Who sees it:** Unauthenticated users  
**Purpose:** Entry point for all three roles. Register creates a patient account
by default. Doctor accounts are created by admin only.

**Login must do:**
- Email + password fields
- Supabase Auth `signInWithPassword`
- On success: read role from `user_metadata`, redirect by role:
  - `patient` → `/patient`
  - `doctor` → `/doctor`
  - `admin` → `/admin`
- Error states: invalid credentials, unconfirmed email
- "Forgot password" link (Supabase password reset flow)

**Register must do:**
- Email, password, full name, phone number
- Creates Supabase Auth user with `role: patient` in `user_metadata`
- Creates matching row in `patients` table (via service role in API route)
- On success: redirect → `/patient`

**Both must not do:**
- Allow direct registration as doctor or admin — those are admin-provisioned
- Store password anywhere — Supabase Auth handles this entirely

---

## 7. Summary: What Changes Between Legacy and v2

| Dimension | Legacy | v2 |
|---|---|---|
| Auth | None — any tab is accessible | Supabase Auth with role-based routing |
| Data | InMemoryStore — lost on restart | Supabase Postgres — persisted, indexed |
| Queue isolation | Single global queue | Per-doctor queues, filtered by `doctor_id` |
| Real-time | None — local state mutation only | Supabase Realtime subscriptions |
| Status model | `waiting / active / done` (3 states) | `waiting / called / serving / done / skipped / cancelled` (6 states) |
| AI response | Raw JSON string, sliced at 500 chars | Structured `{ urgency, condition, specialty, advice }` |
| Doctor identity | Hardcoded "Dr. Priya Mehta" | Auth-linked, each doctor owns their session |
| Phone persistence | Collected, silently dropped | Stored in `patients.phone` |
| Doctor deletion | Not possible | Admin DELETE with confirmation |
| Avg wait | Hardcoded `waitingCount * 8` | Computed from real `wait_minutes` data |
| Payments | None | Stripe payment intent + webhook |
| Observability | console.error | Sentry + PostHog |
| Token uniqueness | Race-prone global counter | `next_token_number()` SQL function, scoped per doctor per day |
