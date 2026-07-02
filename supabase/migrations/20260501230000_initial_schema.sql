-- RIPAM Quiz - Schema iniziale (ricostruito dopo ban progetto precedente)
-- 5 tabelle: user_progress, user_stats, simulazioni, dispense_highlights, reading_progress

-- gen_random_uuid() è built-in da Postgres 13+, no extension necessaria

-- ============================================================
-- user_progress: ogni risposta data dall'utente a un quiz
-- ============================================================
create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  quiz_id text not null,
  materia text not null,
  risposta_data text,
  corretto boolean,
  tempo_risposta_ms integer not null default 0,
  created_at timestamptz not null default now(),
  constraint user_progress_user_quiz_unique unique (user_id, quiz_id)
);

create index if not exists user_progress_user_id_idx on public.user_progress (user_id);
create index if not exists user_progress_materia_idx on public.user_progress (materia);

-- ============================================================
-- user_stats: aggregati globali per utente + per materia (JSONB)
-- ============================================================
create table if not exists public.user_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  totale_risposte integer not null default 0,
  risposte_corrette integer not null default 0,
  tempo_totale_ms bigint not null default 0,
  ultima_sessione timestamptz,
  stats_per_materia jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- simulazioni: storico simulazioni esame complete
-- ============================================================
create table if not exists public.simulazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  punteggio numeric(5,2) not null,
  tempo_impiegato_ms bigint not null default 0,
  risposte jsonb not null default '[]'::jsonb,
  completata boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists simulazioni_user_id_idx on public.simulazioni (user_id);
create index if not exists simulazioni_created_at_idx on public.simulazioni (created_at desc);

-- ============================================================
-- dispense_highlights: evidenziazioni testo nei reader EPUB
-- ============================================================
create table if not exists public.dispense_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content_id text not null,
  content_type text not null default 'epub',
  highlight_id text not null,
  pagina integer,
  cfi_range text not null,
  text text not null,
  color text not null default 'yellow',
  nota text,
  created_at timestamptz not null default now(),
  constraint dispense_highlights_unique unique (user_id, content_id, highlight_id)
);

create index if not exists dispense_highlights_user_content_idx on public.dispense_highlights (user_id, content_id);

-- ============================================================
-- reading_progress: posizione lettura per ogni dispensa
-- ============================================================
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content_id text not null,
  content_type text not null default 'epub',
  cfi text,
  percentage integer not null default 0,
  pagina_corrente integer,
  totale_pagine integer,
  completato boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint reading_progress_unique unique (user_id, content_id)
);

create index if not exists reading_progress_user_idx on public.reading_progress (user_id);

-- ============================================================
-- RLS DISABILITATO (come nel progetto originale)
-- L'app usa anon key con accesso diretto via SARA_USER_ID hardcoded
-- ============================================================
alter table public.user_progress disable row level security;
alter table public.user_stats disable row level security;
alter table public.simulazioni disable row level security;
alter table public.dispense_highlights disable row level security;
alter table public.reading_progress disable row level security;

-- ============================================================
-- Permessi per ruolo anon (necessari con RLS off)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant all on public.user_progress to anon, authenticated;
grant all on public.user_stats to anon, authenticated;
grant all on public.simulazioni to anon, authenticated;
grant all on public.dispense_highlights to anon, authenticated;
grant all on public.reading_progress to anon, authenticated;
