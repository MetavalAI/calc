-- ============================================================
-- Metaval Engineering Calculator — Formula storage schema
-- Replaces: formulas/*.json flat files
-- ============================================================

-- ── Table ──────────────────────────────────────────────────
create table if not exists public.formulas (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  formula_json  jsonb not null,
  name          text generated always as (formula_json->>'name') stored,
  tag           text generated always as (coalesce(formula_json->>'tag', '')) stored,
  icon          text generated always as (coalesce(formula_json->>'icon', '🔢')) stored,
  description   text generated always as (coalesce(formula_json->>'description', '')) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.formulas is
  'Engineering calculator formulas. formula_json holds the full definition (inputs, unit conversions, calculate.steps); other columns are generated for fast listing/search.';
create index if not exists idx_formulas_name on public.formulas (name);
create index if not exists idx_formulas_tag  on public.formulas (tag);
create index if not exists idx_formulas_json_gin
  on public.formulas using gin (formula_json jsonb_path_ops);
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
