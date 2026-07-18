grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.formulas
  to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated;
