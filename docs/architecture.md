# MediQueue v2 — Architecture

> Generated: 2026-06-21  
> Stack: Next.js 14 App Router · Supabase · Stripe · OpenAI · Vercel

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL EDGE NETWORK                            │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     NEXT.JS 14 APP ROUTER                            │  │
│  │                                                                      │  │
│  │   PAGES (Server Components)         API ROUTES (Route Handlers)      │  │
│  │   ─────────────────────────         ────────────────────────────     │  │
│  │   /                (landing)        /api/queue          (CRUD)       │  │
│  │   /patient         (token UI)       /api/tokens         (issue)      │  │
│  │   /doctor          (dashboard)      /api/doctors        (CRUD)       │  │
│  │   /admin           (panel)          /api/ai/symptom-check (OpenAI)   │  │
│  │   /symptom-check   (AI triage)      /api/webhooks/stripe  (events)   │  │
│  │   /(auth)/login                                                      │  │
│  │   /(auth)/register                                                   │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                │                                    │                       │
│         middleware.ts                        service role key               │
│       (auth + RBAC guard)                   (server-side only)             │
└────────────────┼────────────────────────────────────┼───────────────────────┘
                 │                                    │
       ┌─────────▼──────────┐             ┌──────────▼──────────┐
       │   SUPABASE AUTH    │             │  SUPABASE POSTGRES  │
       │                    │             │                     │
       │  Roles:            │             │  patients           │
       │  · patient         │◄────────────│  doctors            │
       │  · doctor          │  RLS checks │  queue_entries      │
       │  · admin           │             │  activity_log       │
       └────────────────────┘             └─────────────────────┘
                                                    │
                    ┌───────────────────────────────┼──────────────────────┐
                    │                               │                      │
          ┌─────────▼──────┐             ┌──────────▼──────┐   ┌──────────▼──────┐
          │    OPENAI      │             │     STRIPE      │   │  SENTRY/POSTHOG │
          │  GPT-4o-mini   │             │                 │   │                 │
          │  Symptom triage│             │  Payments       │   │  Errors/Events  │
          └────────────────┘             └─────────────────┘   └─────────────────┘
```

---

## 2. Frontend Pages & Components

```mermaid
graph TD
    ROOT["/ — Landing Page<br/>(public)"]
    PATIENT["/patient — Patient Portal<br/>(authenticated: patient)"]
    DOCTOR["/doctor — Doctor Dashboard<br/>(authenticated: doctor)"]
    ADMIN["/admin — Admin Panel<br/>(authenticated: admin)"]
    SYM["/symptom-check — AI Triage<br/>(authenticated: patient)"]
    LOGIN["/(auth)/login"]
    REGISTER["/(auth)/register"]

    ROOT --> LOGIN
    ROOT --> REGISTER
    LOGIN -->|role=patient| PATIENT
    LOGIN -->|role=doctor| DOCTOR
    LOGIN -->|role=admin| ADMIN
    PATIENT --> SYM

    subgraph PatientViews["Patient Views"]
        PATIENT --> PC1["TokenCard — your queue number"]
        PATIENT --> PC2["QueueStatus — live position"]
        PATIENT --> PC3["SymptomCheckerLink"]
    end

    subgraph DoctorViews["Doctor Views"]
        DOCTOR --> DC1["QueueList — waiting patients"]
        DOCTOR --> DC2["CallButton — call next token"]
        DOCTOR --> DC3["PatientPanel — current patient"]
        DOCTOR --> DC4["LiveToggle — go online/offline"]
    end

    subgraph AdminViews["Admin Views"]
        ADMIN --> AC1["DoctorManager — add/remove doctors"]
        ADMIN --> AC2["ActivityFeed — live event log"]
        ADMIN --> AC3["QueueOverview — all queues"]
        ADMIN --> AC4["StatsPanel — served / skipped"]
    end
```

---

## 3. API Routes

```mermaid
graph LR
    subgraph APIRoutes["API Routes — /app/api/"]
        Q["/api/queue<br/>GET  — fetch queue by doctor<br/>POST — add entry<br/>PATCH — update status"]
        T["/api/tokens<br/>POST — issue next token<br/>GET  — token status by id"]
        D["/api/doctors<br/>GET    — list all doctors<br/>POST   — create doctor<br/>PATCH  — toggle is_live<br/>DELETE — remove doctor"]
        AI["/api/ai/symptom-check<br/>POST — send symptoms<br/>← GPT-4o-mini response<br/>← priority + advice"]
        WH["/api/webhooks/stripe<br/>POST — receive Stripe events<br/>· payment_intent.succeeded<br/>· charge.refunded"]
    end

    Q -->|service_role| SB[(Supabase)]
    T -->|service_role| SB
    D -->|service_role| SB
    AI -->|API key| OAI[OpenAI GPT-4o-mini]
    AI -->|log result| SB
    WH -->|verify sig| ST[Stripe]
    WH -->|record event| SB
```

---

## 4. Database Schema & Relationships

```mermaid
erDiagram
    patients {
        uuid   id          PK
        text   name
        text   phone
        timestamptz created_at
    }

    doctors {
        uuid    id            PK
        text    name
        text    specialty
        boolean is_live
        integer served_count
        integer skipped_count
        timestamptz created_at
    }

    queue_entries {
        uuid        id           PK
        uuid        patient_id   FK
        uuid        doctor_id    FK
        integer     token_number
        text        status
        integer     wait_minutes
        timestamptz booked_at
        timestamptz created_at
    }

    activity_log {
        uuid        id         PK
        text        message
        text        type
        timestamptz created_at
    }

    patients     ||--o{ queue_entries : "has many"
    doctors      ||--o{ queue_entries : "has many"
```

### Status State Machine — `queue_entries.status`

```
                    ┌─────────┐
              ┌────►│ waiting │◄──────────────────┐
              │     └────┬────┘                   │
              │          │ doctor calls token      │
              │     ┌────▼────┐                   │
              │     │ called  │                   │
              │     └────┬────┘                   │
              │          │ patient arrives         │
              │     ┌────▼────┐                   │
              │     │ serving │                   │
              │     └────┬────┘                   │
              │          │                        │
              │    ┌──────────────┐               │
              │    │              │               │
              │  ┌─▼──┐       ┌───▼────┐          │
              │  │done│       │skipped │──────────┘
              │  └────┘       └────────┘  re-queued
              │
           ┌──▼─────────┐
           │ cancelled  │
           └────────────┘
```

---

## 5. Auth Flow & Role-Based Access

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Next.js Page
    participant MW as middleware.ts
    participant SA as Supabase Auth
    participant DB as Supabase DB (RLS)

    U->>FE: Visit /doctor or /admin
    FE->>MW: Request intercepted
    MW->>SA: getUser() — read session cookie
    SA-->>MW: { user, role }

    alt No session
        MW-->>FE: redirect → /login
    else role mismatch (e.g. patient → /doctor)
        MW-->>FE: redirect → /patient
    else Authorised
        MW-->>FE: allow through
        FE->>DB: Server Component fetch (service_role or anon)
        DB-->>FE: RLS-filtered rows
    end
```

### Role Permission Matrix

```
┌────────────────────────┬─────────┬────────┬───────┐
│ Resource               │ patient │ doctor │ admin │
├────────────────────────┼─────────┼────────┼───────┤
│ /patient               │   ✅    │   ❌   │  ✅   │
│ /doctor                │   ❌    │   ✅   │  ✅   │
│ /admin                 │   ❌    │   ❌   │  ✅   │
│ /symptom-check         │   ✅    │   ❌   │  ✅   │
│ GET  /api/queue        │   ✅    │   ✅   │  ✅   │
│ POST /api/queue        │   ✅    │   ❌   │  ✅   │
│ PATCH /api/queue       │   ❌    │   ✅   │  ✅   │
│ GET  /api/doctors      │   ✅    │   ✅   │  ✅   │
│ POST /api/doctors      │   ❌    │   ❌   │  ✅   │
│ PATCH /api/doctors     │   ❌    │   ✅   │  ✅   │
│ DELETE /api/doctors    │   ❌    │   ❌   │  ✅   │
│ POST /api/tokens       │   ✅    │   ❌   │  ✅   │
│ POST /api/ai/symptom-check │ ✅  │   ❌   │  ✅   │
└────────────────────────┴─────────┴────────┴───────┘
```

---

## 6. External Service Integration

```mermaid
graph TB
    subgraph Vercel["Vercel (Edge + Serverless)"]
        NJ[Next.js App]
    end

    subgraph Supabase["Supabase"]
        AUTH[Auth Service]
        DB[(Postgres + RLS)]
        RT[Realtime Subscriptions]
    end

    subgraph External["External APIs"]
        OAI["OpenAI<br/>GPT-4o-mini<br/>Symptom triage"]
        STR["Stripe<br/>Payment intents<br/>Webhook events"]
        SNT["Sentry<br/>Error tracking<br/>Performance"]
        PH["PostHog<br/>Product analytics<br/>Feature flags"]
    end

    NJ -->|"@supabase/ssr (server)"| DB
    NJ -->|"@supabase/ssr (server)"| AUTH
    NJ -->|"subscribe (client)"| RT
    RT -->|"live queue updates"| NJ

    NJ -->|"openai SDK"| OAI
    NJ -->|"stripe SDK + webhook verify"| STR
    NJ -->|"@sentry/nextjs"| SNT
    NJ -->|"posthog-js"| PH
```

---

## 7. Data Flow — Patient Books a Token

```
Patient                  Next.js                 Supabase              OpenAI
  │                         │                       │                     │
  │── POST /api/tokens ────►│                       │                     │
  │   { doctorId, name,     │── INSERT patients ───►│                     │
  │     phone, symptoms }   │◄─ { patientId } ──────│                     │
  │                         │                       │                     │
  │                         │── next_token_number() ►│                    │
  │                         │◄─ tokenNumber ─────────│                    │
  │                         │                       │                     │
  │                         │── POST symptom-check ──────────────────────►│
  │                         │◄─ { priority, advice } ─────────────────────│
  │                         │                       │                     │
  │                         │── INSERT queue_entries►│                    │
  │                         │   { patientId,        │                     │
  │                         │     doctorId,         │                     │
  │                         │     tokenNumber,      │                     │
  │                         │     priority }        │                     │
  │                         │                       │                     │
  │                         │── INSERT activity_log ►│                    │
  │◄── { token, waitMins } ─│                       │                     │
```

---

## 8. Folder → Route Map

```
mediqueue-v2/
├── src/
│   ├── app/
│   │   ├── page.tsx                     →  /
│   │   ├── layout.tsx                   →  root layout + providers
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx           →  /login
│   │   │   └── register/page.tsx        →  /register
│   │   ├── (patient)/
│   │   │   ├── patient/page.tsx         →  /patient
│   │   │   └── symptom-check/page.tsx   →  /symptom-check
│   │   ├── (doctor)/
│   │   │   └── doctor/page.tsx          →  /doctor
│   │   ├── (admin)/
│   │   │   └── admin/page.tsx           →  /admin
│   │   └── api/
│   │       ├── queue/route.ts           →  /api/queue
│   │       ├── tokens/route.ts          →  /api/tokens
│   │       ├── doctors/route.ts         →  /api/doctors
│   │       ├── ai/
│   │       │   └── symptom-check/route.ts → /api/ai/symptom-check
│   │       └── webhooks/
│   │           └── stripe/route.ts      →  /api/webhooks/stripe
│   │
│   ├── components/
│   │   ├── ui/          →  Button, Input, Card, Badge, Spinner
│   │   ├── queue/       →  TokenCard, QueueList, StatusBadge
│   │   ├── doctor/      →  PatientPanel, CallButton, LiveToggle
│   │   └── layout/      →  Navbar, Sidebar, Footer
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts   →  createBrowserClient()
│   │   │   └── server.ts   →  createServerClient()
│   │   ├── stripe.ts       →  Stripe instance + helpers
│   │   ├── openai.ts       →  OpenAI instance
│   │   ├── sentry.ts       →  Sentry init
│   │   ├── posthog.ts      →  PostHog init
│   │   └── utils.ts        →  shared helpers
│   │
│   ├── types/
│   │   ├── database.ts     →  Supabase generated types
│   │   └── index.ts        →  shared app types
│   │
│   ├── hooks/
│   │   ├── useQueue.ts     →  realtime queue subscription
│   │   └── useUser.ts      →  current auth user + role
│   │
│   └── middleware.ts       →  auth guard + RBAC routing
│
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 20260621141003_initial_schema.sql
│
└── docs/
    └── architecture.md     ←  this file
```
