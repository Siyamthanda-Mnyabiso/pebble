#!/usr/bin/env bash
# Runs a database test against a LOCAL Supabase database (never the linked project). The whole run
# happens inside one transaction that is always rolled back, so nothing is kept, not even the
# migration that is being tried. The test's own error text is the report: any line with "BAD" fails.
#
#   supabase/tests/run-local.sh service_categories            # tries every migration newer than the database has, then the test
#   PEBBLE_TEST_DB=postgresql://... supabase/tests/run-local.sh name
#
# The migration named like the test (and any migration sorted after it) is applied first, inside the
# transaction. A file <name>.pre.sql, when present, runs just before that migration (for before/after checks).
set -euo pipefail
cd "$(dirname "$0")/../.."
name="$1"
url="${PEBBLE_TEST_DB:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$url" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing to run: this runner only talks to a local database."; exit 2 ;;
esac
first="$(ls supabase/migrations/*"_${name}.sql" | head -1)"
# A database with no Pebble schema yet (nobody has migrated it) gets every migration, inside the
# same rolled-back transaction, so the test still runs against the real schema.
if [[ "$(psql "$url" -X -Atc "select to_regclass('public.providers')" 2>/dev/null)" == "" ]]; then
  first="$(ls supabase/migrations/*.sql | head -1)"
  echo "No Pebble schema in this database: applying every migration inside the rolled-back transaction."
fi
file="$(mktemp)"
{
  echo "begin;"
  echo "set local lock_timeout = '5s';"
  mine="$(ls supabase/migrations/*"_${name}.sql" | head -1)"
  for m in supabase/migrations/*.sql; do
    if [[ "$m" > "$first" || "$m" == "$first" ]]; then
      # the before snapshot is taken just ahead of the migration under test
      if [[ "$m" == "$mine" && -f "supabase/tests/${name}.pre.sql" ]]; then cat "supabase/tests/${name}.pre.sql"; fi
      cat "$m"; echo
    fi
  done
  cat "supabase/tests/${name}.sql"
  echo "rollback;"
} > "$file"
out="$(psql "$url" -X -q -f "$file" 2>&1 || true)"
rm -f "$file"
echo "$out" | sed 's/\\n/\n/g'
if echo "$out" | grep -q "BAD"; then echo "FAILED: a check reported BAD"; exit 1; fi
if ! echo "$out" | grep -q "P0001\|^ERROR:  *$\|ok  "; then echo "FAILED: the test did not reach its report"; exit 1; fi
echo "PASSED: no check reported BAD"
