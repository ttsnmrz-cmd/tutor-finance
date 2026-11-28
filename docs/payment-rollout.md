# Payment rollout

## Verified writer inventory

Production Pages was checked at `08ae204` on `refactor-modules`. Public HTML and the served `legacy/js/app.js` and `legacy/js/students.js` matched Git blobs. The published app uses two direct POST /payments writers in students.js: the student card and general Add form. Both are replaced by the existing shared handler in this PR. The helper URL returned 404 on production before rollout. Historical widget HTML also references the legacy writer and is covered by the database guard.

The supported creation path in this release is the shared helper → create_payment_once, with one teacher-scoped, persisted UUID, a cross-tab lock and payload checks. Direct inserts must supply a UUID and remain subject to teacher/student validation, database uniqueness and RLS. Observed delete and read routes remain separate. Checked Edge Function sources, integration reference sources, tracked migrations, deployed public/private SQL definitions, triggers and active cron command text. Payment, balance and reminder functions read payments. The separate integration reference copies contain the legacy client code; no separate supported payment-producing integration or automated writer was identified. Read-only catalog checks do not prove that an untracked external client does not call the public Data API. Confirm this operational inventory before release; such clients will fail closed if they omit the key.

## Before approval

1. Verify the current Pages SHA and refresh the last known good artifact and encrypted backup. Confirm that the two payment migration files are unapplied in the target and that no outside writer relies on unkeyed inserts.
2. In isolated staging, use both SQL files together. Run the existing Node tests and the PostgreSQL integration test. Exercise both forms, one stale tab, a lost response, manual reconciliation (saved and cancelled), one intentional repeat, a failed notification status write and historical edits/deletes.
3. Prepare two frontend artifacts from the same accepted base, one updated build and one fallback build that already uses the keyed create_payment_once RPC. Verify both against the guarded schema with synthetic data. Keep the existing Pages source and published URL.

## Approved release order

1. Schedule a payment maintenance window and confirm the target Supabase project in the dashboard before opening SQL Editor. The payment-only bundle consists of these files in order:
   - [20261127_payment_idempotency.sql](../legacy/supabase/migrations/20261127_payment_idempotency.sql)
   - [20261127_payment_operation_required.sql](../legacy/supabase/migrations/20261127_payment_operation_required.sql)
2. If neither migration has run, execute both as **one transaction**: keep the first BEGIN and the second COMMIT, remove only the first COMMIT and the second BEGIN, and submit the combined SQL once. Verify that no earlier statement failed before proceeding. Do not use a blanket migration push: this repository contains historical scripts and repeated date prefixes. Record the exact two scripts and commit in the project’s deployment records. If the first migration is already applied, stop and verify schema provenance before applying the second alone. The default in the first file is transitional; a committed interval with that default would still allow stale writes.
3. Confirm the column is nullable with no default, the unique key and both triggers exist, and the reconciliation function is callable only by authenticated users. The insert guard rejects omitted or explicit null UUIDs, including requests with privileged API roles. Historical rows keep their existing values and remain available to authorized edits/deletions. No server-side version header is required. The trigger is the enforcement boundary.
4. Release the matching notify-payment Edge Function and confirm the selected target project and version. It requires the new delivery status columns. Then publish the matching frontend through the existing GitHub Pages path. Old tabs receive a database rejection until refreshed. Keep payment entry paused until the smoke checks pass.
5. Read-only production checks: confirm Pages SHA and V3 asset versions, verify the schema/RPC and function deployment, open both forms and verify historical payments and balances. Only with separate approval for synthetic production writes, test one payment on a dedicated account, same-key replay and rejection from a stale tab. Perform destructive, concurrency and intentional duplicate-value scenarios in isolated staging. Never use real learners for smoke tests.

## Recovery and rollback

The teacher can retry the same key normally or choose **Check pending payment** and explicitly confirm the check. The server serializes the check with any in-flight insert for the key. If saved, the UI confirms the original payment and refreshes history. If absent, the server permanently cancels that key for that teacher before the browser releases it. A lost reconciliation response preserves the key and allows safe repetition of the check. A previously deleted keyed payment returns removed and cannot be recreated by replay. This does not delete or update payment records.

If deployment breaks before SQL commit, roll back the whole SQL transaction. After commit, keep both migrations, recorded results and notification claims. Roll back frontend assets only to the tested keyed build. If the Edge Function must be rolled back, keep payment creation paused unless the fallback preserves notification claims on ambiguous delivery. If no keyed build can be restored, pause payment creation and repair forward. Do not restore the compatibility UUID default or disable the insert guard.

Recovery in the browser works across tabs of the same origin and profile. A different device, browser profile, cleared storage or malformed pending record requires reconciliation in history before entering the payment again. External integration credentials and provider delivery are separate from SQL validation. Privileged database owners can alter the schema; do not disable triggers for normal writes.
