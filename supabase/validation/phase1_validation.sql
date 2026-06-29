-- Phase 1 validation queries.
-- Replace :migration_batch_id with the batch under review.

select
  migration_status,
  count(*) as payload_count
from legacy_import_payloads
where migration_batch_id = :migration_batch_id
group by migration_status
order by migration_status;

select count(*) as imported_stories_without_legacy_payload
from stories s
left join legacy_import_payloads p on p.canonical_story_id = s.id
where s.migration_batch_id = :migration_batch_id
  and p.id is null;

select count(*) as imported_stories_without_source_material
from stories s
left join story_source_links ssl on ssl.story_id = s.id
where s.migration_batch_id = :migration_batch_id
  and ssl.id is null;

select count(*) as legacy_archive_unknown_rationale
from legacy_import_payloads
where migration_batch_id = :migration_batch_id
  and legacy_source_system in ('story_archive', 'data/story-archive.json')
  and coalesce(payload->>'why_it_cannot_be_ignored', payload->>'score_reasoning', '') = '';

select count(*) as story_bank_no_actionable_source_links
from legacy_import_payloads p
join stories s on s.id = p.canonical_story_id
left join story_source_links ssl on ssl.story_id = s.id
left join source_material sm on sm.id = ssl.source_material_id
where p.migration_batch_id = :migration_batch_id
  and s.portfolio_lane = 'story_bank'
group by p.id
having count(sm.canonical_url) = 0;

select count(*) as canonical_story_key_collisions
from (
  select workspace_id, canonical_key, count(*) as key_count
  from stories
  where canonical_key is not null
  group by workspace_id, canonical_key
  having count(*) > 1
) collisions;

select count(*) as self_relations
from story_relations
where from_story_id = to_story_id;

with recursive merge_paths as (
  select id as origin_id, merged_into_story_id as next_id, array[id] as path
  from stories
  where merged_into_story_id is not null
  union all
  select mp.origin_id, s.merged_into_story_id, mp.path || s.id
  from merge_paths mp
  join stories s on s.id = mp.next_id
  where s.merged_into_story_id is not null
    and not s.id = any(mp.path)
)
select count(*) as merged_story_cycles
from merge_paths
where next_id = any(path);

select count(*) as post_cutover_legacy_payloads_missing_batch
from legacy_import_payloads
where migration_batch_id is null;
