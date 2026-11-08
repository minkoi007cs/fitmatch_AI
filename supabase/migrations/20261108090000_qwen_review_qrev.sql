-- QREV-QUOTA / QREV-SNAPSHOT / QREV-STATUS (Codex review 2026-11-08 of 95d59ad). Additive.
--
-- QUOTA: analysis jobs now count against the SAME per-owner job policy as fm_v2_enqueue (50 jobs per
-- UTC day, 20 active) under the same serialization key (73), and the snapshot photo against the asset
-- policy of fm_v2_asset_intent (100 per 24 h, key 74). Dedupe never consumes quota; retry checks the
-- active limit like fm_v2_job_action. No new limits are invented.
--
-- SNAPSHOT: the private snapshot copy is reserved durably BEFORE the object is uploaded: a pending
-- asset row plus a CL-PRIV-01 cleanup intent that becomes due after a 15 minute grace. Enqueue
-- finalizes (asset ready, intent removed). Any failure in between (upload error, item deleted or
-- changed, quota, lost race, crash) leaves an intent the route/collector executes; the dedupe winner's
-- snapshot is never touched because only unreferenced reservations are armed.
--
-- STATUS: workers report whether the shared GPU lock was busy at their last heartbeat, so the UI can say
-- "PC busy" truthfully without revealing whose work is running.
begin;

alter table public.fm_v2_workers add column gpu_busy boolean not null default false;

create function public.fm_v2_analysis_reserve(p_user uuid, p_item uuid, p_source_path text, p_sha text,
  p_policy text, p_asset uuid, p_bytes bigint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a fm_v2_analyses; v_path text := p_user::text || '/analysis/' || p_asset::text || '.jpg'; begin
 -- Same order everywhere: job key 73, then asset key 74.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 73));
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 perform 1 from fm_wardrobe_items where id = p_item and user_id = p_user and image_path = p_source_path;
 if not found then raise exception 'ITEM_NOT_FOUND'; end if;
 if p_sha !~ '^[0-9a-f]{64}$' or p_bytes not between 1 and 10485760 then raise exception 'INVALID_INPUT'; end if;
 select * into a from fm_v2_analyses where user_id = p_user and item_id = p_item and image_sha256 = p_sha and policy_revision = p_policy;
 if found then return jsonb_build_object('deduped', true, 'analysisId', a.id); end if;
 if (select count(*) from fm_v2_jobs where user_id = p_user and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 50
    or (select count(*) from fm_v2_jobs where user_id = p_user and state in ('queued','running')) >= 20
    or (select count(*) from fm_v2_assets where user_id = p_user and created_at > now() - interval '24 hours') >= 100 then
  raise exception 'QUOTA_EXCEEDED';
 end if;
 insert into fm_v2_assets(id, user_id, kind, state, path, source_path, expected_bytes, expected_sha256)
  values (p_asset, p_user, 'photo', 'pending', v_path, v_path, p_bytes, p_sha);
 -- Durable before the upload: if nothing finalizes this reservation the collector removes the object.
 insert into fm_v2_source_cleanup(user_id, asset_id, path, next_attempt_at)
  values (p_user, p_asset, v_path, now() + interval '15 minutes');
 return jsonb_build_object('deduped', false, 'assetId', p_asset, 'path', v_path);
end $$;

-- Route compensation after a failed upload/enqueue: tombstone an UNREFERENCED reservation and make its
-- intent due now. Returns the paths still to remove. Never touches an asset an analysis uses.
create function public.fm_v2_analysis_abort(p_user uuid, p_asset uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare paths jsonb; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 73));
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 if exists(select 1 from fm_v2_analyses where image_asset_id = p_asset) then return '[]'::jsonb; end if;
 update fm_v2_assets set state = 'deleted', deleted_at = now()
  where id = p_asset and user_id = p_user and kind = 'photo' and state in ('pending','ready');
 insert into fm_v2_source_cleanup(user_id, asset_id, path)
 select x.user_id, x.id, p.path from fm_v2_assets x cross join lateral (values (x.path), (x.source_path)) p(path)
  where x.id = p_asset and x.user_id = p_user on conflict (asset_id, path) do nothing;
 update fm_v2_source_cleanup set next_attempt_at = now(), updated_at = now()
  where asset_id = p_asset and user_id = p_user and state = 'pending';
 select coalesce(jsonb_agg(distinct path), '[]'::jsonb) into paths from fm_v2_source_cleanup
  where asset_id = p_asset and user_id = p_user and state <> 'completed';
 return paths;
end $$;

-- Same signature as QINT-C; now finalizes a reservation and enforces the shared quota atomically.
create or replace function public.fm_v2_analysis_enqueue(p_user uuid, p_item uuid, p_source_path text, p_asset uuid,
  p_sha text, p_policy text, p_analysis uuid, p_job uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a fm_v2_analyses; j fm_v2_jobs; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 73));
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 perform 1 from fm_wardrobe_items where id = p_item and user_id = p_user and image_path = p_source_path;
 if not found then raise exception 'ITEM_NOT_FOUND'; end if;
 perform 1 from fm_v2_assets where id = p_asset and user_id = p_user and kind = 'photo' and state = 'pending'
  and expected_sha256 = p_sha;
 if not found then raise exception 'INVALID_ASSET'; end if;
 -- The reservation must still be live (its grace-period intent not yet executed by the collector).
 perform 1 from fm_v2_source_cleanup where asset_id = p_asset and user_id = p_user and state = 'pending';
 if not found then raise exception 'SNAPSHOT_EXPIRED'; end if;
 select * into a from fm_v2_analyses where user_id = p_user and item_id = p_item and image_sha256 = p_sha and policy_revision = p_policy;
 if found then
  -- Lost a race: this reservation is surplus; the winner's snapshot is untouched.
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

-- Same signature; serialized with job creation (key 73) and retry respects the active-job limit.
create or replace function public.fm_v2_analysis_action(p_user uuid, p_analysis uuid, p_action text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare j fm_v2_jobs; a fm_v2_analyses; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 73));
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 74));
 select * into a from fm_v2_analyses where id = p_analysis and user_id = p_user for update;
 if not found then raise exception 'ANALYSIS_NOT_FOUND'; end if;
 select * into j from fm_v2_jobs where analysis_id = a.id for update;
 if p_action = 'cancel' then
  if a.status <> 'pending' or j.state not in ('queued','running') then return false; end if;
  update fm_v2_jobs set state = 'canceled', error_code = 'CANCELED', lease_token = null, lease_until = null,
   claim_instance = null, claim_request = null, updated_at = now() where id = j.id;
  return true;
 elsif p_action = 'retry' then
  if a.status <> 'pending' or j.state not in ('failed','canceled') or j.attempt >= 3 then return false; end if;
  if not exists(select 1 from fm_wardrobe_items where id = a.item_id and user_id = p_user and image_path = a.source_path)
     or not exists(select 1 from fm_v2_assets where id = a.image_asset_id and state = 'ready') then
   raise exception 'SOURCE_CHANGED';
  end if;
  if (select count(*) from fm_v2_jobs where user_id = p_user and state in ('queued','running')) >= 20 then
   raise exception 'QUOTA_EXCEEDED';
  end if;
  update fm_v2_jobs set state = 'queued', error_code = null, deferrals = 0, not_before = null, stage = null,
   updated_at = now() where id = j.id;
  return true;
 end if;
 raise exception 'INVALID_INPUT';
end $$;

revoke all on function public.fm_v2_analysis_reserve(uuid,uuid,text,text,text,uuid,bigint),
  public.fm_v2_analysis_abort(uuid,uuid) from public, anon, authenticated;
grant execute on function public.fm_v2_analysis_reserve(uuid,uuid,text,text,text,uuid,bigint),
  public.fm_v2_analysis_abort(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
