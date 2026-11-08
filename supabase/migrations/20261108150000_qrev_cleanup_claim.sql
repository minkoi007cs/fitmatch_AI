-- QREV-CLEANUP-RACE (Codex re-review 2026-11-08 of 7631cb0). Additive.
--
-- fm_v2_source_cleanup_due is a plain read. A collector that removed the paths it read could race a
-- concurrent fm_v2_analysis_enqueue that finalized the same reservation (asset ready, intent deleted)
-- and delete the snapshot behind a published analysis.
--
-- Fix: removal ownership is CLAIMED in the database before any external remove, under the same per-owner
-- serialization as enqueue (advisory keys 73 then 74):
--   * an unreferenced pending reservation is tombstoned in the claiming transaction, so enqueue (which
--     requires a pending asset) can never finalize it afterwards -> SNAPSHOT_EXPIRED;
--   * a reservation that enqueue already finalized has no intent any more and is not seen;
--   * an intent whose asset is live (ready/rejected/pending-but-referenced) is never claimed;
--   * a claim is a lease with a token: duplicate collectors take disjoint rows, a lost report is retried
--     after the lease, and a late report from a superseded claim changes nothing.
-- fm_v2_source_cleanup_due stays a side-effect-free read for dry runs (claimed rows excluded).
-- fm_v2_analysis_abort reopens a completed removal of an unreferenced reservation, so an upload that
-- lands after the collector already removed the path is removed again (removal is idempotent).
begin;

alter table public.fm_v2_source_cleanup add column claim_token uuid, add column claimed_until timestamptz,
  add constraint fm_v2_source_cleanup_claim_pair check ((claim_token is null) = (claimed_until is null));

create function public.fm_v2_source_cleanup_claim(p_token uuid, p_limit int default 100, p_lease_seconds int default 300)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare lim int := least(greatest(coalesce(p_limit, 100), 1), 500); n int := 0; u uuid; r record;
 out jsonb := '[]'::jsonb; begin
 if p_token is null or p_lease_seconds is null or p_lease_seconds not between 30 and 3600 then
  raise exception 'INVALID_INPUT';
 end if;
 -- Owners in a fixed order so concurrent collectors never wait on each other's locks in a cycle.
 for u in select distinct c.user_id from fm_v2_source_cleanup c
   where c.state = 'pending' and c.attempts < 5 and c.next_attempt_at <= now()
     and (c.claimed_until is null or c.claimed_until <= now())
   order by c.user_id loop
  exit when n >= lim;
  perform pg_advisory_xact_lock(hashtextextended(u::text, 73));
  perform pg_advisory_xact_lock(hashtextextended(u::text, 74));
  -- Re-read under the owner's locks: anything enqueue finalized meanwhile is gone.
  for r in select c.id, c.path, c.asset_id, a.state as asset_state,
      exists(select 1 from fm_v2_analyses x where x.image_asset_id = c.asset_id) as referenced
    from fm_v2_source_cleanup c join fm_v2_assets a on a.id = c.asset_id
    where c.user_id = u and c.state = 'pending' and c.attempts < 5 and c.next_attempt_at <= now()
      and (c.claimed_until is null or c.claimed_until <= now())
    order by c.next_attempt_at, c.id
    limit lim - n
    for update of c skip locked loop
   if r.referenced then continue; end if;          -- a published analysis' snapshot: never
   if r.asset_state = 'pending' then
    -- Fence: an abandoned reservation becomes permanently non-finalizable before anything is removed.
    update fm_v2_assets set state = 'deleted', deleted_at = now() where id = r.asset_id and state = 'pending';
   elsif r.asset_state <> 'deleted' then
    continue;                                       -- live asset (ready/rejected): never
   end if;
   update fm_v2_source_cleanup set claim_token = p_token, claimed_until = now() + make_interval(secs => p_lease_seconds),
    updated_at = now() where id = r.id;
   out := out || jsonb_build_object('userId', u, 'path', r.path);
   n := n + 1;
  end loop;
 end loop;
 return out;
end $$;

-- Result of a claimed removal. Only rows still claimed by this token change; the claim is released.
create function public.fm_v2_source_cleanup_claim_report(p_token uuid, p_user uuid, p_paths text[], p_ok boolean,
  p_error text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare touched uuid[]; n int; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 73));
 if p_token is null or coalesce(array_length(p_paths, 1), 0) = 0 then return jsonb_build_object('updated', 0); end if;
 if array_length(p_paths, 1) > 1000 then raise exception 'INVALID_INPUT'; end if;
 with upd as (
   update fm_v2_source_cleanup c set
     attempts = c.attempts + 1,
     state = case when p_ok then 'completed' when c.attempts + 1 >= 5 then 'failed' else 'pending' end,
     last_error = case when p_ok then null else left(coalesce(nullif(p_error, ''), 'STORAGE_ERROR'), 200) end,
     completed_at = case when p_ok then now() end,
     next_attempt_at = case when p_ok then c.next_attempt_at
                            else now() + least(interval '1 minute' * power(2, c.attempts), interval '6 hours') end,
     claim_token = null, claimed_until = null, updated_at = now()
   where c.user_id = p_user and c.path = any(p_paths) and c.state = 'pending' and c.claim_token = p_token
   returning c.asset_id)
 select array_agg(distinct asset_id), count(*) into touched, n from upd;
 perform fm_v2_source_cleanup_refresh(p_user, touched);
 return jsonb_build_object('updated', n);
end $$;

-- Dry-run read: unchanged shape, no side effects, rows under an active claim are not "due".
create or replace function public.fm_v2_source_cleanup_due(p_limit int default 100)
returns jsonb language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('userId', d.user_id, 'path', d.path, 'attempts', d.attempts)), '[]'::jsonb) from (
    select c.user_id, c.path, c.attempts from fm_v2_source_cleanup c
     where c.state = 'pending' and c.attempts < 5 and c.next_attempt_at <= now()
       and (c.claimed_until is null or c.claimed_until <= now())
     order by c.next_attempt_at, c.id
     limit least(greatest(coalesce(p_limit, 100), 1), 500)) d
$$;

-- Same signature as QREV; a reservation fenced by a collector reports SNAPSHOT_EXPIRED.
create or replace function public.fm_v2_analysis_enqueue(p_user uuid, p_item uuid, p_source_path text, p_asset uuid,
  p_sha text, p_policy text, p_analysis uuid, p_job uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a fm_v2_analyses; j fm_v2_jobs; s text; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 73));
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 perform 1 from fm_wardrobe_items where id = p_item and user_id = p_user and image_path = p_source_path;
 if not found then raise exception 'ITEM_NOT_FOUND'; end if;
 select state into s from fm_v2_assets where id = p_asset and user_id = p_user and kind = 'photo' and expected_sha256 = p_sha;
 if s = 'deleted' then raise exception 'SNAPSHOT_EXPIRED'; end if;
 if s is distinct from 'pending' then raise exception 'INVALID_ASSET'; end if;
 perform 1 from fm_v2_source_cleanup where asset_id = p_asset and user_id = p_user and state = 'pending';
 if not found then raise exception 'SNAPSHOT_EXPIRED'; end if;
 select * into a from fm_v2_analyses where user_id = p_user and item_id = p_item and image_sha256 = p_sha and policy_revision = p_policy;
 if found then
  update fm_v2_assets set state = 'deleted', deleted_at = now() where id = p_asset and user_id = p_user;
  update fm_v2_source_cleanup set next_attempt_at = now(), updated_at = now() where asset_id = p_asset and state = 'pending';
  select * into j from fm_v2_jobs where analysis_id = a.id;
  return jsonb_build_object('analysisId', a.id, 'jobId', j.id, 'deduped', true);
 end if;
 if (select count(*) from fm_v2_jobs where user_id = p_user and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 50
    or (select count(*) from fm_v2_jobs where user_id = p_user and state in ('queued','running')) >= 20 then
  raise exception 'QUOTA_EXCEEDED';
 end if;
 update fm_v2_assets set state = 'ready', bytes = expected_bytes, sha256 = p_sha where id = p_asset;
 delete from fm_v2_source_cleanup where asset_id = p_asset and user_id = p_user and state = 'pending';
 insert into fm_v2_analyses(id, user_id, item_id, source_path, image_asset_id, image_sha256, policy_revision)
  values (p_analysis, p_user, p_item, p_source_path, p_asset, p_sha, p_policy);
 insert into fm_v2_jobs(id, user_id, analysis_id, kind, idempotency_key, payload_hash)
  values (p_job, p_user, p_analysis, 'garment.analyze', 'analysis:' || p_analysis, p_sha);
 return jsonb_build_object('analysisId', p_analysis, 'jobId', p_job, 'deduped', false);
end $$;

-- Same signature as QREV. Also reopens a completed removal of an unreferenced analysis reservation:
-- the route only calls abort after it has (possibly) uploaded the object, which may have landed after
-- a collector already removed the path.
create or replace function public.fm_v2_analysis_abort(p_user uuid, p_asset uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare paths jsonb; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 73));
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 if exists(select 1 from fm_v2_analyses where image_asset_id = p_asset) then return '[]'::jsonb; end if;
 if not exists(select 1 from fm_v2_assets where id = p_asset and user_id = p_user and kind = 'photo'
               and path = p_user::text || '/analysis/' || p_asset::text || '.jpg') then
  return '[]'::jsonb;                                  -- only analysis reservations, only the owner's
 end if;
 update fm_v2_assets set state = 'deleted', deleted_at = now()
  where id = p_asset and user_id = p_user and state in ('pending','ready');
 insert into fm_v2_source_cleanup(user_id, asset_id, path)
 select x.user_id, x.id, p.path from fm_v2_assets x cross join lateral (values (x.path), (x.source_path)) p(path)
  where x.id = p_asset and x.user_id = p_user on conflict (asset_id, path) do nothing;
 update fm_v2_source_cleanup set state = 'pending', completed_at = null, attempts = 0, last_error = null,
   next_attempt_at = now(), claim_token = null, claimed_until = null, updated_at = now()
  where asset_id = p_asset and user_id = p_user and state = 'completed';
 update fm_v2_source_cleanup set next_attempt_at = now(), updated_at = now()
  where asset_id = p_asset and user_id = p_user and state = 'pending';
 select coalesce(jsonb_agg(distinct path), '[]'::jsonb) into paths from fm_v2_source_cleanup
  where asset_id = p_asset and user_id = p_user and state = 'pending';
 return paths;
end $$;

revoke all on function public.fm_v2_source_cleanup_claim(uuid,int,int),
  public.fm_v2_source_cleanup_claim_report(uuid,uuid,text[],boolean,text) from public, anon, authenticated;
grant execute on function public.fm_v2_source_cleanup_claim(uuid,int,int),
  public.fm_v2_source_cleanup_claim_report(uuid,uuid,text[],boolean,text) to service_role;

notify pgrst, 'reload schema';
commit;
