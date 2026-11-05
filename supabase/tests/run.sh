#!/usr/bin/env bash
# Runs a database test against the linked Supabase project. Every test ends by raising an error on purpose,
# so nothing is ever committed. The error text is the report: any line containing "BAD" is a failure.
#
#   supabase/tests/run.sh completion_disputes_payments            # test only (migration already applied)
#   supabase/tests/run.sh completion_disputes_payments --before   # try the migration of the same name first
#
set -euo pipefail
cd "$(dirname "$0")/../.."
name="$1"
file="$(mktemp)"
if [[ "${2:-}" == "--before" ]]; then
  cat supabase/migrations/*"_${name}.sql" "supabase/tests/${name}.sql" > "$file"
else
  cat "supabase/tests/${name}.sql" > "$file"
fi
out="$(supabase db query --linked -f "$file" 2>&1 || true)"
rm -f "$file"
echo "$out" | sed 's/\\n/\n/g'
if echo "$out" | grep -q "BAD"; then echo "FAILED: a check reported BAD"; exit 1; fi
if ! echo "$out" | grep -q "P0001"; then echo "FAILED: the test did not reach its report"; exit 1; fi
echo "PASSED: no check reported BAD"
