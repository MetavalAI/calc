-- ============================================================
-- Metaval Engineering Calculator — Formula storage schema
-- Replaces: formulas/*.json flat files
-- ============================================================

-- ── Table ──────────────────────────────────────────────────
create table if not exists public.formulas (
  id            uuid primary key default gen_random_uuid(),

  -- Human-readable unique key. Replaces "filename" from the old
  -- Flask app (e.g. "cv-calculator"). Frontend keeps using this
  -- as the lookup key, so the migration off filenames is a
  -- near 1:1 swap instead of a full rewrite.
  slug          text unique not null,

  -- The complete formula object exactly as it existed in the
  -- JSON file: formula string, definitions, unitSystems, inputs,
  -- calculate.steps — all of it, verbatim. Single source of truth.
  formula_json  jsonb not null,

  -- Generated (computed, read-only) columns pulled out of
  -- formula_json. These exist ONLY for fast filtering / search /
  -- listing (e.g. the Formula Library search box, tag filter).
  -- They are never written directly — Postgres derives them from
  -- formula_json automatically, so there is no risk of the column
  -- and the JSON blob drifting out of sync.
  name          text generated always as (formula_json->>'name') stored,
  tag           text generated always as (coalesce(formula_json->>'tag', '')) stored,
  icon          text generated always as (coalesce(formula_json->>'icon', '🔢')) stored,
  description   text generated always as (coalesce(formula_json->>'description', '')) stored,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.formulas is
  'Engineering calculator formulas. formula_json holds the full definition (inputs, unit conversions, calculate.steps); other columns are generated for fast listing/search.';

-- ── Indexes ────────────────────────────────────────────────
-- slug already has a unique index via the UNIQUE constraint above.

-- Speeds up the Formula Library search box (name ilike / tag filter).
create index if not exists idx_formulas_name on public.formulas (name);
create index if not exists idx_formulas_tag  on public.formulas (tag);

-- Optional but cheap: lets you query *inside* formula_json later
-- (e.g. "find all formulas with a 'pressure' input") without a
-- sequential scan. Not used by the current UI, but costs little
-- and saves a migration later if you build that feature.
create index if not exists idx_formulas_json_gin
  on public.formulas using gin (formula_json jsonb_path_ops);

-- ── updated_at auto-maintenance ───────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_formulas_updated_at on public.formulas;
create trigger trg_formulas_updated_at
  before update on public.formulas
  for each row
  execute function public.set_updated_at();

-- ── Slug auto-generation (mirrors Flask's safe_slug()) ────
-- If the frontend doesn't supply a slug on insert, derive one from
-- formula_json->>'name': lowercase, non-alphanumerics -> '-', trim,
-- capped at 60 chars — identical rule to the old app.py. If that
-- slug is already taken, append -2, -3, etc. until unique.
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.formulas_autoslug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix    int := 1;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base_slug := left(public.slugify(new.formula_json->>'name'), 60);
    if base_slug = '' then
      base_slug := 'formula';
    end if;
    candidate := base_slug;
    while exists (
      select 1 from public.formulas
      where slug = candidate and id is distinct from new.id
    ) loop
      suffix := suffix + 1;
      candidate := base_slug || '-' || suffix;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_formulas_autoslug on public.formulas;
create trigger trg_formulas_autoslug
  before insert or update on public.formulas
  for each row
  execute function public.formulas_autoslug();

-- ── Row Level Security ────────────────────────────────────
-- Deliberately NOT enabled yet. Enabling RLS now, with zero
-- policies, would block all access — including from Phase 3's
-- test connection. RLS + policies land in a dedicated phase
-- once the frontend is wired up and we can verify reads/writes
-- end-to-end, then lock it down safely.
-- (Tracked for a later phase: `alter table public.formulas enable row level security;`)
