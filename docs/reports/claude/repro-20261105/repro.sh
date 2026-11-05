#!/usr/bin/env bash
# Repro of V2 control-plane gaps on an isolated local PostgreSQL 16 (no network, synthetic IDs).
# Uses an unmodified copy of supabase/migrations/20261105_studio_control_plane.sql (sha256 149fbcbf…).
set -euo pipefail
uuidgen() { python3 -c "import uuid;print(uuid.uuid4())"; }
DIR="$(cd "$(dirname "$0")" && pwd)"
P="psql -h /tmp/pgrepro -U postgres -v ON_ERROR_STOP=1 -Atq"
$P -c "drop database if exists repro" >/dev/null
$P -c "create database repro" >/dev/null
Q="$P -d repro"
rm -f "$DIR"/.photos-*
O=11111111-1111-4111-a111-111111111111; O2=22222222-2222-4222-a222-222222222222
W1=44444444-4444-4444-a444-444444444444; W2=55555555-5555-4555-a555-555555555555
$Q >/dev/null <<SQL
do \$\$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end \$\$;
create schema auth; grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as \$\$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid\$\$;
create table auth.users(id uuid primary key); insert into auth.users values('$O'),('$O2');
create table fm_wardrobe_items(id uuid primary key,user_id uuid,category text); grant select on fm_wardrobe_items to service_role;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
SQL
$Q -f "${MIGRATION:-$DIR/src/supabase/migrations/20261105_studio_control_plane.sql}" >/dev/null
S() { $Q -c "set role service_role; $1" | tail -n1; }
photo() { printf 'aaaaaaaa-aaaa-4aaa-aaaa-%012d' "$1"; }
for u in "$O" "$O2"; do for n in 1 2 3; do
  id=$(uuidgen); S "insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,bytes,sha256) values('$id','$u','photo','ready','$u/v/$id','$u/s/$id',10,10,'x')" >/dev/null
  echo "$id" >> "$DIR/.photos-$u"; done; done
caps='{"avatar.reconstruct":{"model":"m","revision":"r"},"garment.drape":{"model":"m","revision":"r"}}'
S "insert into fm_v2_workers(id,user_id,token_hash,name,capabilities,last_seen) values('$W1','$O','h1','pc','$caps',now()),('$W2','$O2','h2','pc','$caps',now())" >/dev/null
inputs() { echo "array[$(sed "s/.*/'&'/" "$DIR/.photos-$1" | paste -sd,)]::uuid[]"; }
enq() { S "select fm_v2_enqueue('$1','$2','$2','avatar','A',$(inputs "$1"),'{}')"; }
claim() { S "select fm_v2_claim('$1')"; }
field() { python3 -c "import json,sys; d=json.loads(sys.stdin.read() or 'null'); print('' if d is None else d['$1'])"; }
glb() { local id job=null; id=$(uuidgen); [[ -n "$2" ]] && job="'$2'"; S "insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,bytes,sha256,job_id) values('$id','$1','glb','ready','$1/g/$id','$1/gs/$id',100,100,'y',$job)" >/dev/null; echo "$id"; }
tr_() { S "select fm_v2_transition('$1','$2','$3','$4',$5,$6)"; }
state() { S "select state||'|attempt='||attempt||'|err='||coalesce(error_code,'-')||'|out='||coalesce((select output_asset_id::text from fm_v2_models m where m.id=j.model_id),'null') from fm_v2_jobs j where id='$1'"; }

pass=0; fail=0
expect() { if [[ "$2" == "$3" ]]; then echo "  REPRODUCED: $1 ($2)"; pass=$((pass+1)); else echo "  NOT REPRODUCED: $1 (got '$2', expected '$3')"; fail=$((fail+1)); fi; }

echo "R1 lost complete reply: replay of the same complete is refused (not idempotent)"
enq "$O" key-r1-aaaa >/dev/null; J=$(claim "$W1"); JID=$(echo "$J"|field id); TOK=$(echo "$J"|field lease_token)
A=$(glb "$O" "$JID")
expect "first complete accepted" "$(tr_ "$W1" "$JID" "$TOK" complete null "'$A'")" t
expect "identical complete replay returns false -> worker gets HTTP 409" "$(tr_ "$W1" "$JID" "$TOK" complete null "'$A'")" f
expect "job stays succeeded" "$(state "$JID" | cut -d'|' -f1)" succeeded

echo "R1b complete request never reached server; worker.py then sends fail -> finalized output discarded"
enq "$O" key-r1b-aaaa >/dev/null; J=$(claim "$W1"); JID=$(echo "$J"|field id); TOK=$(echo "$J"|field lease_token)
A=$(glb "$O" "$JID")   # finalize succeeded, GLB is ready
expect "fail accepted although a ready GLB exists for this job" "$(tr_ "$W1" "$JID" "$TOK" fail "'INFERENCE_FAILED'" null)" t
expect "job failed, model has no output" "$(state "$JID" | sed 's/|attempt=[0-9]*//')" "failed|err=INFERENCE_FAILED|out=null"

echo "R2 lost claim reply: same worker gets nothing until lease expiry, then a new attempt"
enq "$O" key-r2-aaaa >/dev/null; J=$(claim "$W1"); JID=$(echo "$J"|field id)
expect "re-claim by same worker returns null (204)" "$(claim "$W1")" ""
expect "job is running attempt 1 with nobody working on it" "$(state "$JID" | cut -d'|' -f1,2)" "running|attempt=1"
S "update fm_v2_jobs set lease_until=now()-interval '1 second' where id='$JID'" >/dev/null   # simulate 120 s passing
J2=$(claim "$W1")
expect "after expiry the same job is re-issued as attempt 2" "$(echo "$J2"|field attempt)" 2
TOK2=$(echo "$J2"|field lease_token); tr_ "$W1" "$JID" "$TOK2" fail "'INFERENCE_FAILED'" null >/dev/null

echo "R3 capabilities are whatever the worker declares (no server-side allowlist)"
S "update fm_v2_workers set capabilities='{\"garment.reconstruct\":{\"model\":\"anything\",\"revision\":\"x\"}}' where id='$W1'" >/dev/null  # what /heartbeat does with body.capabilities
expect "worker row has no operator-approved capability column" "$(S "select count(*) from information_schema.columns where table_name='fm_v2_workers' and column_name ilike '%allow%'")" 0
S "update fm_v2_workers set capabilities='$caps' where id='$W1'" >/dev/null

echo "R4 fitting cache dead end after 3 failed attempts"
AV=$(uuidgen); GM=$(uuidgen); AA=$(glb "$O" ""); GA=$(glb "$O" "")
S "insert into fm_v2_models(id,user_id,kind,name,output_asset_id) values('$AV','$O','avatar','av','$AA'),('$GM','$O','garment','gm','$GA')" >/dev/null
F="select fm_v2_enqueue('$O','KEY','KEY','fitting','F','{}','{}',null,'$AV','$GM')"
FJ=$(S "${F//KEY/key-fit-1aaa}" | field jobId)
for i in 1 2 3; do J=$(claim "$W1"); tr_ "$W1" "$(echo "$J"|field id)" "$(echo "$J"|field lease_token)" fail "'OOM'" null >/dev/null; S "select fm_v2_job_action('$O','$FJ','retry')" >/dev/null || true; done
expect "retry refused after attempt 3" "$(S "select fm_v2_job_action('$O','$FJ','retry')")" f
R=$(S "${F//KEY/key-fit-2aaa}")
expect "new request with fresh key returns the same dead job" "$(echo "$R"|field jobId)" "$FJ"
expect "that job is permanently failed" "$(state "$FJ" | cut -d'|' -f1)" failed

echo "R5 two owners, one GPU: two worker identities can both hold running jobs at the same time"
enq "$O" key-r5-aaaa >/dev/null; enq "$O2" key-r5-bbbb >/dev/null
J1=$(claim "$W1"); J2=$(claim "$W2")
expect "both claims succeed concurrently" "$([[ -n "$(echo "$J1"|field id)" && -n "$(echo "$J2"|field id)" ]] && echo yes || echo no)" yes
expect "running jobs at once" "$(S "select count(*) from fm_v2_jobs where state='running'")" 2

echo; echo "Summary: $pass reproduced, $fail not reproduced"
