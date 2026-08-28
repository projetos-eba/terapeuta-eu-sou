#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_root"

db_container="$(docker ps --format '{{.Names}}' | rg '^supabase_db_' | head -n 1)"
if [[ -z "$db_container" ]]; then
  echo "Supabase local database is not running." >&2
  exit 1
fi

first_output="$(mktemp)"
second_output="$(mktemp)"

cleanup() {
  docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "delete from public.booking_holds where id in ('a1030000-0000-4000-8000-000000000101', 'a1030000-0000-4000-8000-000000000102'); alter table public.booking_holds enable trigger validate_booking_hold_schedule;" \
    >/dev/null 2>&1 || true
  rm -f "$first_output" "$second_output"
}
trap cleanup EXIT

docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "delete from public.booking_holds where id in ('a1030000-0000-4000-8000-000000000101', 'a1030000-0000-4000-8000-000000000102'); alter table public.booking_holds disable trigger validate_booking_hold_schedule;" \
  >/dev/null

first_sql="begin; insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at) values ('a1030000-0000-4000-8000-000000000101', 'b1000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2099-02-01 21:30:00+00', '2099-02-01 22:20:00+00', 'America/Sao_Paulo', 'patient-concurrency-hold-0001', '2099-12-31 00:00:00+00'); select pg_sleep(1); commit;"
second_sql="begin; insert into public.booking_holds (id, patient_profile_id, therapist_profile_id, service_id, starts_at, ends_at, timezone, idempotency_key, expires_at) values ('a1030000-0000-4000-8000-000000000102', 'b1000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', '2099-02-01 21:30:00+00', '2099-02-01 22:30:00+00', 'America/Sao_Paulo', 'patient-concurrency-hold-0002', '2099-12-31 00:00:00+00'); select pg_sleep(1); commit;"

set +e
docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "$first_sql" >"$first_output" 2>&1 &
first_pid=$!
docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "$second_sql" >"$second_output" 2>&1 &
second_pid=$!
wait "$first_pid"
first_status=$?
wait "$second_pid"
second_status=$?
set -e

successes=0
[[ "$first_status" -eq 0 ]] && successes=$((successes + 1))
[[ "$second_status" -eq 0 ]] && successes=$((successes + 1))

conflicts=0
rg -q 'PATIENT_SCHEDULE_CONFLICT' "$first_output" && conflicts=$((conflicts + 1))
rg -q 'PATIENT_SCHEDULE_CONFLICT' "$second_output" && conflicts=$((conflicts + 1))

rows="$(docker exec -i "$db_container" psql -U postgres -d postgres -Atc "select count(*) from public.booking_holds where id in ('a1030000-0000-4000-8000-000000000101', 'a1030000-0000-4000-8000-000000000102');")"

if [[ "$successes" -ne 1 || "$conflicts" -ne 1 || "$rows" -ne 1 ]]; then
  echo "Expected one success, one PATIENT_SCHEDULE_CONFLICT and one persisted hold; got successes=$successes conflicts=$conflicts rows=$rows." >&2
  exit 1
fi

echo "PASS: one concurrent hold succeeded and one returned PATIENT_SCHEDULE_CONFLICT."
