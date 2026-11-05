# Deployment runbook: pending database changes

Nothing below has been applied to production. Apply only after the owner approves.

## Pending migrations (in order)

| Migration | What it does | Risk to existing data |
| --- | --- | --- |
| `20261105120000_completion_disputes_payments` | Adds `confirm_by` and `completed_at` to bookings, `awaiting_confirmation` flow, `disputes`, `payments`, `payment_events`, payout states, `provider_earnings_summary`, a cron job that auto-confirms stale jobs. Replaces `enforce_booking_status`. | Existing rows are untouched (new columns are nullable). Behaviour change: a provider can no longer mark a job `completed` directly. The deployed app must be the new version at the same time. |
| `20261105130000_dispute_evidence` | Private `dispute-evidence` bucket, `dispute_evidence` table, `add_dispute_evidence`. | New objects only. |
| `20261105140000_admin_commission_stats` | `admin_stats()` totals commission instead of the removed fee. | Replaces one read-only function. |

All three only add objects or replace functions. None drops a table or column or rewrites booking rows. The one
constraint that changes is `bookings_payout_status_check`, widened to allow `processing` and `failed`.

## State of production on 2026-11-05 (read-only snapshot)

`supabase/tests/production_snapshot.sql` returns counts and a checksum of booking rows. At the time of writing:
1 booking (`pending`), 1 profile, 10 providers, 0 payouts, 0 reviews, checksum `cf25aed45d6f764b46f01c2cebe1ae67`.
Run it before and after. The booking count and checksum must be identical, because no migration touches those
columns.

## Backup (before applying)

1. Supabase dashboard: Project, Database, Backups. Take a manual backup, or confirm the latest daily backup.
   (Point-in-time recovery is a paid add-on; check the plan.)
2. A JSON copy of every `public` table was exported to `~/pebble-backups/` (outside the repo, mode 600). Auth users
   and storage files are not in it. To refresh: `supabase db query --linked -f` the export query in this runbook's
   history, or run `supabase db dump --linked -f schema.sql` once Docker is installed.
3. Record `supabase migration list --linked`: last applied is `20261105110000`.

## Order of deployment

1. Merge PR #1 (do not deploy yet).
2. Run `supabase/tests/run.sh completion_disputes_payments --before` and the other scenario tests on staging.
3. Take the backup above and run the snapshot.
4. `supabase db push` (applies the three migrations in order).
5. Immediately `npx vercel deploy --prod --yes` so the new screens match the new rules.
6. Run the snapshot again and compare. Open a provider booking, a customer booking, Admin Settings and Disputes.

Between steps 4 and 5 a provider pressing "Mark complete" on the old site gets "That status change is not allowed".
With one booking in production this is acceptable; keep the gap short.

## Rollback

The migrations add objects, so rolling back means making the old app work again:

1. Redeploy the previous Vercel build (Vercel dashboard, Deployments, Promote the previous production build).
2. Restore the old status rule by re-running the `enforce_booking_status` definition from
   `20261105100100_booking_scheduling.sql` (it still allows a provider to complete directly when payments are off).
3. Optional full removal, in this order: `drop trigger bookings_sync_money_state on public.bookings;`, drop the
   functions `sync_booking_money_state`, `complete_stale_confirmations`, `report_booking_issue`, `reply_to_dispute`,
   `resolve_dispute`, `record_payment_event`, `provider_earnings_summary`, `add_dispute_evidence`,
   `is_dispute_party`; `select cron.unschedule('complete-stale-confirmations');`; drop tables `dispute_evidence`,
   `disputes`, `payments`, `payment_events`; drop columns `confirm_by`, `completed_at`. Only do this if no disputes or
   payments exist, because they would be lost. A disputed booking would need its status set by hand first.
4. For data loss or corruption, restore the dashboard backup, or compare against the JSON export.

## Safety switch

`payments_enabled = 0` and `gateway_ready = 0` are not touched by any of these migrations.
