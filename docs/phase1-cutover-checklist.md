# Phase 1 Canonical Cutover Checklist

## Before Apply

- Confirm the production target is the Jimmy project: `auzjilvjqjblgysargum`.
- Confirm the Phase 1 backup schema and local backup manifest exist.
- Confirm live legacy counts still match the backup baseline:
  `jimmy_memory=135`, `story_bank=1`, `story_archive=0`, `daily_runs=0`, `watch_list=0`.
- Use only the committed schema migration file from the release commit.
- Do not use local fixture Story, Archive, or Jimmy memory files for production import.
- Do not proceed if legacy counts changed unexpectedly.

## Schema Migration

- Apply `supabase/migrations/20260628000000_phase1_canonical_newsroom.sql`.
- Confirm `workspaces`, `actors`, `departments`, `workspace_memberships`, `stories`, `source_material`, `ingestion_runs`, `ingestion_items`, `migration_batches`, and `legacy_import_payloads` exist.
- Confirm `import_live_jimmy_legacy(boolean)` and `validate_phase1_migration(uuid)` exist.

## Live Database Import

- Run `npm run migrate:phase1:production:dry`.
- Confirm it logs target project ref `auzjilvjqjblgysargum`.
- Confirm it calls `import_live_jimmy_legacy(true)`.
- Confirm dry-run counts match the backup baseline exactly.
- Run `npm run migrate:phase1:production:apply`.
- Confirm it calls `import_live_jimmy_legacy(false)`.
- Record the `migration_batch_id`.
- Run `validate_phase1_migration(migration_batch_id)` and/or `supabase/validation/phase1_validation.sql` for that batch.
- Confirm imported canonical Stories all have legacy payloads.
- Confirm Story Bank and Archive are canonical Story states.
- Confirm legacy `story_bank` and `story_archive` are not write targets.
- Stop if validation finds malformed or unmapped records.

## Source Registry Seed

- Run `npm run seed:source-registry`.
- Confirm it logs target project ref `auzjilvjqjblgysargum`.
- Confirm it reads only `data/gamesmith-sources.json`.
- Confirm source registry rows are created or updated idempotently.
- Record the source registry seed `migration_batch_id`.

## Local Fixture Test Import

- Fixture import is local-development tooling only.
- Use `npm run migrate:phase1:fixture:dry` and `npm run migrate:phase1:fixture:apply` only against non-production databases.
- The fixture runner must refuse the Jimmy production project.
- Fixture files are `data/story-bank.json`, `data/story-archive.json`, `data/jimmy-memory.json`, and `data/watch-list.json`; these must never be production import sources.

## Rollback

- Do not modify or delete legacy tables.
- Disable API route cutover if validation fails.
- Use `migration_batch_id` to identify all imported canonical rows.
- Before acceptance, failed batch rows may be ignored or removed through a controlled administrative migration.
- Do not delete ingestion history, Source Material, legacy payloads, migration records, finalized Editorial Decisions, or Activity Events after acceptance.

## Cutover

- Browser clients must not access canonical tables directly until RLS policies and memberships are verified.
- Server-side service-role routes must still verify bearer auth, active membership, actor identity, role, and Story transition validity.
- Remove destructive reset-memory UI/API behavior.
- Keep `watch_list` preserved until each row is classified.

## Release Report Format

- Schema migration: applied/not applied, commit SHA, migration filename, result.
- Live database import: dry-run counts, apply result, migration batch ID, validation result.
- Source registry seed: created count, updated count, migration batch ID.
- Local fixture test import: not run in production; include local-only result if used before release.
- Legacy tables: pre/post counts and confirmation of no writes.
- Deployment: preview result, production deployment ID/URL, maintenance mode status.
- Smoke tests: authenticated William flow, Jimmy intake, GOOD/MAYBE/BAD transitions, Story Bank canonical read, export, daily-run auth, reset-memory non-destructive.
