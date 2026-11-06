-- C3: garbage-collection DRY RUN. Read-only: lists what a future collector could remove after a
-- grace period. Nothing is deleted by this migration or by the function.
begin;
create function public.fm_v2_gc_candidates(p_grace interval default interval '7 days')
returns table(reason text, asset_id uuid, user_id uuid, kind text, state text, path text, source_path text, age interval)
language sql stable security invoker set search_path = public as $$
  -- Uploads that were never finalized (staging only).
  select 'stale-pending', a.id, a.user_id, a.kind, a.state, a.path, a.source_path, now() - a.created_at
    from fm_v2_assets a where a.state = 'pending' and a.created_at < now() - p_grace
  union all
  -- Job outputs that failed verification.
  select 'rejected-output', a.id, a.user_id, a.kind, a.state, a.path, a.source_path, now() - a.created_at
    from fm_v2_assets a where a.state = 'rejected' and a.created_at < now() - p_grace
  union all
  -- Tombstoned sources: the row stays forever; only leftover objects are candidates.
  select 'deleted-source-objects', a.id, a.user_id, a.kind, a.state, a.path, a.source_path, now() - a.deleted_at
    from fm_v2_assets a where a.state = 'deleted' and a.deleted_at < now() - p_grace
  union all
  -- Ready GLBs of a job that never became the model output (e.g. an earlier attempt).
  select 'unpublished-output', a.id, a.user_id, a.kind, a.state, a.path, a.source_path, now() - a.created_at
    from fm_v2_assets a
   where a.kind = 'glb' and a.state = 'ready' and a.job_id is not null and a.created_at < now() - p_grace
     and not exists (select 1 from fm_v2_models m where m.output_asset_id = a.id)
  union all
  -- Every ready asset keeps a staging copy after finalize; it is never read again.
  select 'verified-staging-copy', a.id, a.user_id, a.kind, a.state, null, a.source_path, now() - a.created_at
    from fm_v2_assets a where a.state = 'ready' and a.created_at < now() - p_grace
$$;
revoke all on function public.fm_v2_gc_candidates(interval) from public, anon, authenticated;
grant execute on function public.fm_v2_gc_candidates(interval) to service_role;
notify pgrst, 'reload schema';
commit;
