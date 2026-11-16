-- Disposable local restored database only. All synthetic records and confirmations roll back.
begin;
do $$ begin
 if current_database() !~ '^fitmatch_cat54_' then raise exception 'LOCAL_CAT54_DATABASE_REQUIRED'; end if;
end $$;

do $$
declare
 owner_id uuid := (select id from auth.users order by id limit 1);
 item uuid := gen_random_uuid();
 asset uuid := gen_random_uuid();
 analysis uuid;
 confirmation uuid;
 category text;
 source text;
 sha text := encode(sha256(convert_to('{}','UTF8')),'hex');
 response jsonb;
begin
 if owner_id is null then raise exception 'RESTORED_TEST_OWNER_REQUIRED'; end if;
 source := owner_id::text || '/cat54-synthetic.jpg';
 insert into fm_wardrobe_items(id,user_id,name,category,image_path)
 values(item,owner_id,'CAT54 synthetic','t-shirt',source);
 insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,bytes,sha256)
 values(asset,owner_id,'photo','ready',source,source,2,2,sha);

 foreach category in array array['t-shirt','shirt','hoodie','jacket','sweater','jeans'] loop
  analysis := gen_random_uuid(); confirmation := gen_random_uuid();
  insert into fm_v2_analyses(id,user_id,item_id,source_path,image_asset_id,image_sha256,policy_revision,status,result_json,result_sha256)
  values(analysis,owner_id,item,source,asset,encode(sha256(convert_to(category,'UTF8')),'hex'),'qint.2','review','{}',sha);
  begin
   perform fm_v2_analysis_confirm(gen_random_uuid(),analysis,confirmation,'test',sha,'approve','{}','{"category":"jacket"}');
   raise exception 'FOREIGN_CONFIRM_ACCEPTED';
  exception when others then if sqlerrm <> 'ANALYSIS_NOT_FOUND' then raise; end if; end;
  begin
   perform fm_v2_analysis_confirm(owner_id,analysis,confirmation,'test',repeat('0',64),'approve','{}','{"category":"jacket"}');
   raise exception 'WRONG_DIGEST_ACCEPTED';
  exception when others then if sqlerrm <> 'RESULT_CHANGED' then raise; end if; end;
  begin
   perform fm_v2_analysis_confirm(owner_id,analysis,confirmation,'test',sha,'approve','{}','{"category":"unknown"}');
   raise exception 'UNKNOWN_CATEGORY_ACCEPTED';
  exception when others then if sqlerrm <> 'INVALID_INPUT' then raise; end if; end;
  begin
   perform fm_v2_analysis_confirm(owner_id,analysis,confirmation,'test',sha,'approve','{}','{"material":"cotton"}');
   raise exception 'EXTRA_COLUMN_ACCEPTED';
  exception when others then if sqlerrm <> 'INVALID_INPUT' then raise; end if; end;
  update fm_wardrobe_items set image_path=source||'.changed' where id=item;
  begin
   perform fm_v2_analysis_confirm(owner_id,analysis,confirmation,'test',sha,'approve','{}','{"category":"jacket"}');
   raise exception 'STALE_SOURCE_ACCEPTED';
  exception when others then if sqlerrm <> 'SOURCE_CHANGED' then raise; end if; end;
  update fm_wardrobe_items set image_path=source where id=item;
  response := fm_v2_analysis_confirm(owner_id,analysis,confirmation,'test',sha,'approve',
   jsonb_build_object('category',case when category='t-shirt' then 'tshirt' else category end),jsonb_build_object('category',category));
  if response <> '{"status":"confirmed","replay":false}'::jsonb then raise exception 'CONFIRM_FAILED'; end if;
  if (select i.category from fm_wardrobe_items i where id=item) <> category then raise exception 'CATEGORY_CHANGED'; end if;
  response := fm_v2_analysis_confirm(owner_id,analysis,confirmation,'test',sha,'approve','{}','{}');
  if response <> '{"status":"confirmed","replay":true}'::jsonb then raise exception 'REPLAY_FAILED'; end if;
 end loop;
 raise notice 'CAT54 PASS: six category confirmations, replay, owner/digest/source/allowlist refusals';
end $$;
rollback;
