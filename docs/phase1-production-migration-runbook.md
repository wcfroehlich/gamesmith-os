# Phase 1 Production Migration Runbook

This runbook covers the manually triggered database migration for the Jimmy production Supabase project only.

Creator Brain is off-limits. Do not inspect, modify, migrate, reuse, delete, or deploy anything related to Creator Brain.

## Required GitHub Secrets

Add these repository secrets in `wcfroehlich/gamesmith-os` before running the workflow:

- `SUPABASE_ACCESS_TOKEN`: Supabase access token allowed to link and push migrations for the Jimmy project.
- `SUPABASE_DB_PASSWORD`: Database password for project `auzjilvjqjblgysargum`.

Do not commit secrets, echo them in logs, store them in Vercel variables for this migration, or place them in package scripts.

## Manual Launch

1. Open GitHub Actions for `wcfroehlich/gamesmith-os`.
2. Select `Phase 1 Production Migration`.
3. Choose `Run workflow`.
4. Use branch `phase1-canonical-newsroom`.
5. Enter this confirmation phrase exactly:

```text
APPLY_PHASE1_TO_JIMMY_PRODUCTION
```

The workflow is `workflow_dispatch` only. It must not run on push, pull request, schedule, deployment, or any automated trigger.

## Hard Locks

The workflow refuses to continue unless all of these match:

- Repository: `wcfroehlich/gamesmith-os`
- Project ref: `auzjilvjqjblgysargum`
- Commit: `ca33b24e08780509d5c88b5bf635762b2dba3366`
- Migration file: `supabase/migrations/20260628000000_phase1_canonical_newsroom.sql`
- Migration SHA-256: `1d300efc11bb9d9673b79c572a933879c990f14723a8979a56336541e92a1f81`
- Manual confirmation: `APPLY_PHASE1_TO_JIMMY_PRODUCTION`

## Expected Successful Outputs

A successful run should show:

- Verified commit and migration checksum.
- Pre-migration legacy counts:
  - `jimmy_memory = 135`
  - `story_bank = 1`
  - `story_archive = 0`
  - `daily_runs = 0`
  - `watch_list = 0`
- Supabase migration dry run succeeded.
- Supabase migration push succeeded.
- Canonical tables, RLS, functions, triggers, and seed records verified.
- `import_live_jimmy_legacy(true)` returned matching live counts.
- `import_live_jimmy_legacy(false)` returned a `migration_batch_id`.
- `validate_phase1_migration(migration_batch_id)` returned no blocking validation failures.
- Migration batch status is `succeeded`.
- Post-import legacy counts still match the baseline.

The workflow does not deploy Vercel. Database migration and application deployment remain separate manual phases.

## Stop Conditions

The workflow must fail immediately if:

- The repository, commit, project ref, migration file, or checksum differs.
- The baseline legacy counts differ.
- The Supabase migration dry run fails.
- Schema verification fails.
- `import_live_jimmy_legacy(true)` returns different counts.
- `import_live_jimmy_legacy(false)` returns a partial or failed batch.
- `validate_phase1_migration` reports unresolved or malformed records.
- Legacy table counts change.

## Rollback Readiness

Before this workflow is run, the Phase 1 backup schema must already exist:

```text
phase1_backup_20260628_222734
```

Rollback approach if the workflow fails:

1. Do not deploy the application.
2. Leave legacy tables untouched as the system-of-record rollback evidence.
3. Record the failed workflow URL, failed step, and any `migration_batch_id`.
4. Use `migration_batches`, `legacy_import_payloads`, and the backup schema to assess exactly what was written.
5. Do not perform ad hoc production fixes. Prepare a reviewed corrective migration or controlled rollback plan.

After a successful workflow, continue with the separate app deployment checklist only after validation output is reviewed.
