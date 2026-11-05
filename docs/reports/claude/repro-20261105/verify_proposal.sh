#!/usr/bin/env bash
# Apply proposed_worker_recovery.sql on top of the original migration and check new behavior (synthetic).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
uuidgen() { python3 -c "import uuid;print(uuid.uuid4())"; }
P="psql -h /tmp/pgrepro -U postgres -v ON_ERROR_STOP=1 -Atq"
$P -c "drop database if exists proposal" >/dev/null 2>&1; $P -c "create database proposal" >/dev/null
Q="$P -d proposal"; O=11111111-1111-4111-a111-111111111111; W=44444444-4444-4444-a444-444444444444
$Q >/dev/null <<SQL
create schema auth; create function auth.uid() returns uuid language sql stable as \$\$select null::uuid\$\$;
create table auth.users(id uuid primary key); insert into auth.users values('$O');
create table fm_wardrobe_items(id uuid primary key,user_id uuid,category text); grant select on fm_wardrobe_items to service_role;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
SQL
$Q -f "${MIGRATION:-$DIR/../src/supabase/migrations/20261105_studio_control_plane.sql}" >/dev/null
$Q -f "$DIR/proposed_worker_recovery.sql" >/dev/null
S() { $Q -c "set role service_role; $1" | tail -n1; }
field() { python3 -c "import json,sys; d=json.loads(sys.stdin.read() or 'null'); print('' if d is None else d['$1'])"; }
ok=0; bad=0; expect() { if [[ "$2" == "$3" ]]; then echo "  OK: $1"; ok=$((ok+1)); else echo "  FAIL: $1 (got '$2', expected '$3')"; bad=$((bad+1)); fi; }
ids=(); for n in 1 2 3; do id=$(uuidgen); ids+=("'$id'"); S "insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,bytes,sha256) values('$id','$O','photo','ready','v/$id','s/$id',10,10,'x')" >/dev/null; done
IN="array[$(IFS=,; echo "${ids[*]}")]::uuid[]"
S "insert into fm_v2_workers(id,user_id,token_hash,name,capabilities,last_seen) values('$W','$O','h','pc','{\"avatar.reconstruct\":{\"model\":\"m\",\"revision\":\"r\"}}',now())" >/dev/null
enq() { S "select fm_v2_enqueue('$O','$1','$1','avatar','A',$IN,'{}')" >/dev/null; }
I1=$(uuidgen); I2=$(uuidgen)
echo "P4 allowlist"; enq key-p4-aaaa
expect "declared but not granted -> no claim" "$(S "select fm_v2_claim('$W','$I1')")" ""
S "update fm_v2_workers set allowed_capabilities='{avatar.reconstruct}' where id='$W'" >/dev/null
echo "P2 redelivery"; J=$(S "select fm_v2_claim('$W','$I1')"); JID=$(echo "$J"|field id); TOK=$(echo "$J"|field lease_token)
R=$(S "select fm_v2_claim('$W','$I1')")
expect "same instance gets same job" "$(echo "$R"|field id)" "$JID"
expect "same token, same attempt" "$(echo "$R"|field lease_token)/$(echo "$R"|field attempt)" "$TOK/1"
expect "other instance gets nothing" "$(S "select fm_v2_claim('$W','$I2')")" ""
S "select fm_v2_transition('$W','$JID','$TOK','heartbeat','reconstructing',null)" >/dev/null
expect "no redelivery after progress was reported" "$(S "select fm_v2_claim('$W','$I1')")" ""
echo "P1 idempotent complete"; A=$(uuidgen)
S "insert into fm_v2_assets(id,user_id,kind,state,path,source_path,expected_bytes,bytes,sha256,job_id) values('$A','$O','glb','ready','g/$A','gs/$A',100,100,'y','$JID')" >/dev/null
expect "first complete" "$(S "select fm_v2_transition('$W','$JID','$TOK','complete',null,'$A')")" t
expect "identical replay" "$(S "select fm_v2_transition('$W','$JID','$TOK','complete',null,'$A')")" t
expect "replay with other asset refused" "$(S "select fm_v2_transition('$W','$JID','$TOK','complete',null,'$(uuidgen)')")" f
expect "replay with wrong token refused" "$(S "select fm_v2_transition('$W','$JID','$(uuidgen)','complete',null,'$A')")" f
expect "fail after success refused" "$(S "select fm_v2_transition('$W','$JID','$TOK','fail','INFERENCE_FAILED',null)")" f
echo "compat"; enq key-p2-bbbb
expect "old 1-arg claim still works" "$(S "select fm_v2_claim('$W')" | field attempt)" 1
echo "Summary: $ok ok, $bad failed"
