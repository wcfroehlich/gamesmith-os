# Phase 1 Canonical Cutover Checklist

## Before Apply

- Run the schema migration.
- Confirm `workspaces`, `actors`, `departments`, and `workspace_memberships` exist.
- Add at least one active Supabase-authenticated William/editor membership before browser-facing mutations.
- Run `npm run migrate:phase1:dry`.
- Review exact, deduplicated, unresolved, malformed, no-source, archive-unknown-rationale, and bank-no-actionable-source categories.
- Do not proceed unless every legacy record is accounted for by one category.

## Apply

- Run the migration with `--apply`.
- Record the `migration_batch_id`.
- Run `supabase/validation/phase1_validation.sql` for that batch.
- Confirm imported canonical Stories all have legacy payloads.
- Confirm Story Bank and Archive are canonical Story states.
- Confirm legacy `story_bank` and `story_archive` are not write targets.

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
