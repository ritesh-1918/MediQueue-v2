-- =============================================================================
-- MediQueue — Initial Schema
-- Migration: 20260621141003_initial_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- uuid-ossp is pre-installed on Supabase but gen_random_uuid() may not be
-- in the search path. Use gen_random_uuid() (built-in since Postgres 13)
-- everywhere instead — no extension required.
-- create extension if not exists "uuid-ossp";


-- ===========================================================================
-- TABLE: patients
-- ===========================================================================
create table public.patients (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null,
  phone        text        not null,
  created_at   timestamptz not null default now()
);

comment on table public.patients is 'Registered clinic patients.';

-- Indexes
create index idx_patients_phone on public.patients (phone);

-- RLS
alter table public.patients enable row level security;

-- Patients can read and update their own row (matched by auth.uid stored in a
-- separate auth mapping; for now we allow authenticated reads and service-role
-- writes so the admin panel and queue API can manage records).
create policy "Authenticated users can read patients"
  on public.patients for select
  to authenticated
  using (true);

create policy "Service role can insert patients"
  on public.patients for insert
  to service_role
  with check (true);

create policy "Service role can update patients"
  on public.patients for update
  to service_role
  using (true);


-- ===========================================================================
-- TABLE: doctors
-- ===========================================================================
create table public.doctors (
  id             uuid    primary key default gen_random_uuid(),
  name           text    not null,
  specialty      text    not null,
  is_live        boolean not null default false,
  served_count   integer not null default 0,
  skipped_count  integer not null default 0,
  created_at     timestamptz not null default now()
);

comment on table public.doctors is 'Doctor profiles and live-status tracking.';

-- Indexes
create index idx_doctors_is_live on public.doctors (is_live);

-- RLS
alter table public.doctors enable row level security;

create policy "Authenticated users can read doctors"
  on public.doctors for select
  to authenticated
  using (true);

create policy "Service role can insert doctors"
  on public.doctors for insert
  to service_role
  with check (true);

create policy "Service role can update doctors"
  on public.doctors for update
  to service_role
  using (true);

create policy "Service role can delete doctors"
  on public.doctors for delete
  to service_role
  using (true);


-- ===========================================================================
-- TABLE: queue_entries
-- ===========================================================================
create table public.queue_entries (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid        not null references public.patients  (id) on delete cascade,
  doctor_id      uuid        not null references public.doctors   (id) on delete cascade,
  token_number   integer     not null,
  status         text        not null default 'waiting'
                   check (status in ('waiting', 'called', 'serving', 'done', 'skipped', 'cancelled')),
  wait_minutes   integer,
  booked_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

comment on table public.queue_entries is 'Live queue — one row per patient-doctor appointment slot.';

-- Ensure token numbers are unique per doctor per day
-- date_trunc on timestamptz is STABLE (timezone-dependent), which is not
-- allowed in index expressions. timezone('UTC', ...) returns a plain timestamp
-- and is IMMUTABLE, so we use that as the day-bucketing expression instead.
create unique index idx_queue_token_per_doctor_day
  on public.queue_entries (doctor_id, token_number, date_trunc('day', timezone('UTC', booked_at)));

-- Query patterns: fetch queue by doctor, fetch by status, fetch by patient
create index idx_queue_doctor_id   on public.queue_entries (doctor_id);
create index idx_queue_patient_id  on public.queue_entries (patient_id);
create index idx_queue_status      on public.queue_entries (status);
create index idx_queue_booked_at   on public.queue_entries (booked_at desc);

-- RLS
alter table public.queue_entries enable row level security;

create policy "Authenticated users can read queue entries"
  on public.queue_entries for select
  to authenticated
  using (true);

create policy "Service role can insert queue entries"
  on public.queue_entries for insert
  to service_role
  with check (true);

create policy "Service role can update queue entries"
  on public.queue_entries for update
  to service_role
  using (true);

create policy "Service role can delete queue entries"
  on public.queue_entries for delete
  to service_role
  using (true);


-- ===========================================================================
-- TABLE: activity_log
-- ===========================================================================
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  message     text not null,
  type        text not null default 'info'
                check (type in ('info', 'success', 'warning', 'error')),
  created_at  timestamptz not null default now()
);

comment on table public.activity_log is 'Append-only audit log for queue and admin events.';

-- Query pattern: latest-first feed
create index idx_activity_log_created_at on public.activity_log (created_at desc);
create index idx_activity_log_type       on public.activity_log (type);

-- RLS
alter table public.activity_log enable row level security;

create policy "Authenticated users can read activity log"
  on public.activity_log for select
  to authenticated
  using (true);

create policy "Service role can insert activity log"
  on public.activity_log for insert
  to service_role
  with check (true);

-- Activity log is append-only — no update or delete policies.


-- ===========================================================================
-- FUNCTION: next_token_number
-- Returns the next available token number for a given doctor on today's date.
-- ===========================================================================
create or replace function public.next_token_number(p_doctor_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(
    max(token_number), 0
  ) + 1
  from public.queue_entries
  where doctor_id = p_doctor_id
    and date_trunc('day', booked_at) = date_trunc('day', now());
$$;

comment on function public.next_token_number is
  'Returns the next sequential token number for a doctor on the current day.';
