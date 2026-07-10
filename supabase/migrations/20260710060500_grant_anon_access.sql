-- ============================================================
-- Grant table access to Supabase's anon/authenticated roles
-- ============================================================
-- Without this, PostgREST returns 401 "permission denied for
-- table formulas" for every request — even though RLS isn't
-- enabled. GRANTs and RLS are two separate permission layers:
-- GRANTs decide whether a role can touch the table at all; RLS
-- (added in a later phase) further restricts which ROWS it can
-- see once access is granted. We're fixing layer 1 here.
--
-- We grant this explicitly rather than relying on the project's
-- implicit defaults, so behavior is identical and reproducible
-- on local dev, `supabase db reset`, and the hosted project.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on public.formulas
  to anon, authenticated;

-- Ensures any FUTURE tables you add also get this by default,
-- so this doesn't need repeating for every new table.
alter default privileges in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated;
