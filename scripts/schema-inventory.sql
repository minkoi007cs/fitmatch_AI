-- ENV-CANON-01 — READ-ONLY schema inventory (BACKEND-024 preflight). Returns ONE json value.
-- Run on the canonical project from the Supabase Dashboard SQL editor (or psql with a read-only role).
-- It reads system catalogs only: no user rows, no object names inside buckets, no secrets. Policy
-- expressions and column default expressions are schema text (needed to compare effective access).
-- Row counts are planner estimates (pg_class.reltuples), bucket figures are aggregate counts/bytes.
-- Save the result PRIVATELY (never GitHub/Drive public); compare with
--   node scripts/compare-schema-inventory.mjs docs/infrastructure/schema-manifest.json <saved.json>
-- Nothing here changes the database. If your client wraps it, you can also run it inside
--   begin read only; <this query>; rollback;
with
tables as (
  select c.oid, n.nspname as schema, c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as rls_forced,
         greatest(c.reltuples, 0)::bigint as est_rows
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and n.nspname in ('public', 'storage', 'auth', 'supabase_migrations')
),
cols as (
  select t.schema, t.name, jsonb_agg(jsonb_build_object(
           'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'notNull', a.attnotnull,
           'hasDefault', a.atthasdef, 'default', pg_get_expr(d.adbin, d.adrelid)) order by a.attnum) as columns
  from tables t join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  group by t.schema, t.name
),
cons as (
  select t.schema, t.name, jsonb_agg(jsonb_build_object('name', k.conname, 'type', k.contype,
           'def', pg_get_constraintdef(k.oid)) order by k.conname) as constraints
  from tables t join pg_constraint k on k.conrelid = t.oid group by t.schema, t.name
),
idx as (
  select t.schema, t.name, jsonb_agg(jsonb_build_object('name', i.relname, 'def', pg_get_indexdef(i.oid)) order by i.relname) as indexes
  from tables t join pg_index x on x.indrelid = t.oid join pg_class i on i.oid = x.indexrelid group by t.schema, t.name
),
funcs as (
  select jsonb_agg(jsonb_build_object(
           'schema', n.nspname, 'name', p.proname, 'args', pg_get_function_identity_arguments(p.oid),
           'returns', pg_get_function_result(p.oid), 'securityDefiner', p.prosecdef,
           'bodyMd5', md5(coalesce(p.prosrc, '')),
           'anonExecute', has_function_privilege('anon', p.oid, 'EXECUTE'),
           'authenticatedExecute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
           'extension', (select e.extname from pg_depend dp join pg_extension e on e.oid = dp.refobjid
                         where dp.classid = 'pg_proc'::regclass and dp.objid = p.oid and dp.deptype = 'e' limit 1))
         order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
),
pols as (
  select jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'name', policyname,
           'cmd', cmd, 'roles', roles, 'permissive', permissive,
           'usingMd5', md5(coalesce(qual, '')), 'checkMd5', md5(coalesce(with_check, '')),
           'using', qual, 'check', with_check)
         order by schemaname, tablename, policyname) as v
  from pg_policies where schemaname in ('public', 'storage')
),
trigs as (
  select jsonb_agg(jsonb_build_object('schema', n.nspname, 'table', c.relname, 'name', tg.tgname,
           'def', pg_get_triggerdef(tg.oid)) order by n.nspname, c.relname, tg.tgname) as v
  from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not tg.tgisinternal and n.nspname in ('public', 'auth', 'storage')
),
grants as (
  select jsonb_agg(jsonb_build_object('table', t.name, 'anon', has_table_privilege('anon', t.oid, 'SELECT'),
           'authenticated', has_table_privilege('authenticated', t.oid, 'SELECT'),
           'privileges', (select jsonb_object_agg(r.role, (select coalesce(jsonb_agg(pr.priv order by pr.priv), '[]'::jsonb)
                            from unnest(array['SELECT','INSERT','UPDATE','DELETE']) pr(priv)
                            where has_table_privilege(r.role, t.oid, pr.priv)))
                          from unnest(array['anon','authenticated']) r(role))) order by t.name) as v
  from tables t where t.schema = 'public'
)
select jsonb_build_object(
  'format', 'fitmatch.schema-inventory.v1',
  'serverVersion', current_setting('server_version'),
  'extensions', (select jsonb_agg(jsonb_build_object('name', e.extname, 'version', e.extversion, 'schema', n.nspname) order by e.extname)
                 from pg_extension e join pg_namespace n on n.oid = e.extnamespace),
  'tables', (select jsonb_agg(jsonb_build_object('schema', t.schema, 'name', t.name, 'rls', t.rls, 'rlsForced', t.rls_forced,
                 'estRows', t.est_rows, 'columns', cols.columns, 'constraints', coalesce(cons.constraints, '[]'::jsonb),
                 'indexes', coalesce(idx.indexes, '[]'::jsonb)) order by t.schema, t.name)
             from tables t left join cols using (schema, name) left join cons using (schema, name) left join idx using (schema, name)),
  'functions', (select v from funcs),
  'policies', (select v from pols),
  'triggers', (select v from trigs),
  'publicTableSelectGrants', (select v from grants)
) as inventory;
