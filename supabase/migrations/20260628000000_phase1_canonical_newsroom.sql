create extension if not exists pgcrypto;

do $$ begin create type actor_type as enum ('human', 'agent', 'system', 'integration'); exception when duplicate_object then null; end $$;
do $$ begin create type actor_status as enum ('active', 'disabled', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type workspace_status as enum ('active', 'suspended', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type department_status as enum ('active', 'inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type membership_role as enum ('owner', 'editor_in_chief', 'editor', 'department_lead', 'contributor', 'viewer', 'system_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type membership_status as enum ('active', 'revoked', 'invited', 'disabled'); exception when duplicate_object then null; end $$;
do $$ begin create type triage_decision as enum ('unreviewed', 'good', 'maybe', 'bad'); exception when duplicate_object then null; end $$;
do $$ begin create type portfolio_lane as enum ('assignment_desk', 'active', 'story_bank', 'gem', 'archive'); exception when duplicate_object then null; end $$;
do $$ begin create type intake_state as enum ('unreviewed', 'triaged', 'reopened'); exception when duplicate_object then null; end $$;
do $$ begin create type research_state as enum ('not_started', 'primary', 'primary_complete', 'deep', 'deep_complete', 'needs_update'); exception when duplicate_object then null; end $$;
do $$ begin create type work_item_status as enum ('new', 'ready', 'in_progress', 'blocked', 'review', 'complete', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type editorial_decision_type as enum ('story_triage', 'story_reactivation', 'research_acceptance', 'gem_designation', 'correction_decision'); exception when duplicate_object then null; end $$;
do $$ begin create type activity_event_type as enum ('source_discovered', 'story_created', 'story_updated', 'story_triaged', 'work_item_created', 'legacy_state_imported', 'legacy_payload_imported', 'story_merged', 'source_linked'); exception when duplicate_object then null; end $$;
do $$ begin create type story_relation_type as enum ('duplicate_of', 'follows_up_on', 'related_to', 'supersedes', 'corrected_by'); exception when duplicate_object then null; end $$;
do $$ begin create type migration_status as enum ('pending', 'running', 'succeeded', 'partial', 'failed', 'rolled_back'); exception when duplicate_object then null; end $$;
do $$ begin create type legacy_migration_status as enum ('pending', 'resolved', 'deduplicated', 'unresolved', 'malformed', 'error'); exception when duplicate_object then null; end $$;
do $$ begin create type duplicate_outcome as enum ('new_source', 'duplicate_source', 'possible_duplicate', 'ignored'); exception when duplicate_object then null; end $$;
do $$ begin create type story_outcome as enum ('none', 'created_story', 'updated_story', 'linked_existing_story', 'proposed_duplicate'); exception when duplicate_object then null; end $$;
do $$ begin create type processing_status as enum ('pending', 'processed', 'failed', 'reopened'); exception when duplicate_object then null; end $$;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status workspace_status not null default 'active',
  default_timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists actors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  actor_type actor_type not null,
  display_name text not null,
  status actor_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, display_name, actor_type)
);

create table if not exists workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  actor_id uuid not null references actors(id),
  auth_user_id uuid,
  role membership_role not null,
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (workspace_id, actor_id)
);

create unique index if not exists workspace_memberships_active_auth_user_workspace_idx
  on workspace_memberships(auth_user_id, workspace_id)
  where auth_user_id is not null and status = 'active';

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  code text not null,
  status department_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table if not exists newsroom_objects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  object_type text not null,
  created_by_actor_id uuid not null references actors(id),
  system_generated boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists migration_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  migration_version text not null,
  dry_run boolean not null default false,
  status migration_status not null default 'pending',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  imported_counts jsonb not null default '{}'::jsonb,
  duplicate_counts jsonb not null default '{}'::jsonb,
  unmapped_counts jsonb not null default '{}'::jsonb,
  error_summary text,
  initiated_by_actor_id uuid references actors(id)
);

create table if not exists source_registry_configs (
  id uuid primary key default gen_random_uuid(),
  newsroom_object_id uuid not null unique references newsroom_objects(id),
  workspace_id uuid not null references workspaces(id),
  migration_batch_id uuid references migration_batches(id),
  source_name text not null,
  feed_url text not null,
  source_type text not null,
  source_role text,
  active boolean not null default true,
  priority integer not null default 100,
  reliability_tier integer,
  polling_config jsonb not null default '{}'::jsonb,
  last_successful_run_at timestamptz,
  last_failure_at timestamptz,
  last_failure_summary text,
  configuration_checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_name),
  unique (workspace_id, feed_url)
);

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  newsroom_object_id uuid not null unique references newsroom_objects(id),
  workspace_id uuid not null references workspaces(id),
  migration_batch_id uuid references migration_batches(id),
  run_type text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  source_count integer not null default 0,
  source_item_count integer not null default 0,
  duplicate_count integer not null default 0,
  story_count integer not null default 0,
  error_summary text,
  triggered_by_actor_id uuid not null references actors(id)
);

create table if not exists source_material (
  id uuid primary key default gen_random_uuid(),
  newsroom_object_id uuid not null unique references newsroom_objects(id),
  workspace_id uuid not null references workspaces(id),
  source_registry_config_id uuid references source_registry_configs(id),
  first_ingestion_run_id uuid references ingestion_runs(id),
  migration_batch_id uuid references migration_batches(id),
  source_type text not null,
  publisher_name text,
  author_name text,
  canonical_url text,
  original_url text,
  external_source_id text,
  normalized_title text,
  title text not null,
  published_at timestamptz,
  discovered_at timestamptz,
  retrieved_at timestamptz,
  source_reliability_tier integer,
  content_excerpt text,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  newsroom_object_id uuid not null unique references newsroom_objects(id),
  workspace_id uuid not null references workspaces(id),
  migration_batch_id uuid references migration_batches(id),
  canonical_headline text not null,
  short_description text,
  story_type text,
  discovery_timestamp timestamptz,
  first_published_at timestamptz,
  current_freshness_state text,
  intake_state intake_state not null default 'unreviewed',
  portfolio_lane portfolio_lane not null default 'assignment_desk',
  research_state research_state not null default 'not_started',
  current_triage_decision triage_decision not null default 'unreviewed',
  candidate_key text,
  canonical_key text,
  legacy_import_summary jsonb not null default '{}'::jsonb,
  created_by_actor_id uuid not null references actors(id),
  editorial_owner_actor_id uuid references actors(id),
  current_work_owner_department_id uuid references departments(id),
  merged_into_story_id uuid references stories(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (merged_into_story_id is null or merged_into_story_id <> id),
  check (
    (merged_into_story_id is null)
    or (portfolio_lane = 'archive' and current_triage_decision in ('bad', 'unreviewed'))
  )
);

create table if not exists ingestion_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  ingestion_run_id uuid not null references ingestion_runs(id),
  source_registry_config_id uuid not null references source_registry_configs(id),
  source_material_id uuid references source_material(id),
  story_id uuid references stories(id),
  migration_batch_id uuid references migration_batches(id),
  discovered_at timestamptz not null default now(),
  discovered_url text,
  external_source_id text,
  raw_title text,
  raw_payload jsonb not null default '{}'::jsonb,
  duplicate_outcome duplicate_outcome not null default 'new_source',
  story_outcome story_outcome not null default 'none',
  processing_status processing_status not null default 'pending',
  error_summary text
);

create table if not exists story_source_links (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id),
  source_material_id uuid not null references source_material(id),
  migration_batch_id uuid references migration_batches(id),
  relationship_type text not null,
  linked_by_actor_id uuid not null references actors(id),
  linked_at timestamptz not null default now(),
  notes text,
  active boolean not null default true,
  unique (story_id, source_material_id, relationship_type)
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  newsroom_object_id uuid not null unique references newsroom_objects(id),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  subject_type text not null,
  alternate_names text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name, subject_type)
);

create table if not exists story_subjects (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id),
  subject_id uuid not null references subjects(id),
  relationship_type text not null default 'about',
  created_at timestamptz not null default now(),
  unique (story_id, subject_id)
);

create table if not exists story_relations (
  id uuid primary key default gen_random_uuid(),
  from_story_id uuid not null references stories(id),
  to_story_id uuid not null references stories(id),
  relation_type story_relation_type not null,
  rationale text,
  created_by_actor_id uuid not null references actors(id),
  created_at timestamptz not null default now(),
  check (from_story_id <> to_story_id),
  unique (from_story_id, to_story_id, relation_type)
);

create table if not exists legacy_import_payloads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  migration_batch_id uuid not null references migration_batches(id),
  canonical_story_id uuid references stories(id),
  legacy_source_system text not null,
  legacy_record_id text not null,
  payload jsonb not null,
  checksum text not null,
  imported_at timestamptz not null default now(),
  migration_status legacy_migration_status not null default 'pending',
  resolution_notes text,
  unique (legacy_source_system, legacy_record_id, migration_batch_id)
);

create table if not exists editorial_decisions (
  id uuid primary key default gen_random_uuid(),
  newsroom_object_id uuid not null unique references newsroom_objects(id),
  workspace_id uuid not null references workspaces(id),
  subject_object_id uuid not null references newsroom_objects(id),
  decision_type editorial_decision_type not null,
  outcome text not null,
  decision_rationale text not null,
  decided_by_actor_id uuid not null references actors(id),
  decided_at timestamptz not null default now(),
  supersedes_decision_id uuid references editorial_decisions(id),
  related_version_id uuid
);

create table if not exists work_items (
  id uuid primary key default gen_random_uuid(),
  newsroom_object_id uuid not null unique references newsroom_objects(id),
  workspace_id uuid not null references workspaces(id),
  subject_object_id uuid not null references newsroom_objects(id),
  work_type text not null,
  owning_department_id uuid not null references departments(id),
  assigned_actor_id uuid references actors(id),
  status work_item_status not null default 'new',
  priority text not null default 'normal',
  due_at timestamptz,
  created_by_actor_id uuid not null references actors(id),
  parent_work_item_id uuid references work_items(id),
  blocking_reason text,
  completion_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  subject_object_id uuid not null references newsroom_objects(id),
  migration_batch_id uuid references migration_batches(id),
  event_type activity_event_type not null,
  actor_id uuid not null references actors(id),
  event_timestamp timestamptz not null default now(),
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists newsroom_objects_workspace_type_idx on newsroom_objects(workspace_id, object_type);
create index if not exists source_registry_configs_workspace_active_priority_idx on source_registry_configs(workspace_id, active, priority);
create index if not exists source_material_workspace_canonical_url_idx on source_material(workspace_id, canonical_url);
create unique index if not exists source_material_external_id_uidx on source_material(workspace_id, source_registry_config_id, external_source_id) where external_source_id is not null;
create index if not exists source_material_content_hash_idx on source_material(workspace_id, content_hash);
create index if not exists source_material_title_window_idx on source_material(workspace_id, publisher_name, normalized_title, published_at);
create index if not exists ingestion_items_run_source_idx on ingestion_items(ingestion_run_id, source_registry_config_id);
create index if not exists ingestion_items_source_material_idx on ingestion_items(source_material_id);
create unique index if not exists stories_canonical_key_uidx on stories(workspace_id, canonical_key) where canonical_key is not null;
create index if not exists stories_candidate_key_idx on stories(workspace_id, candidate_key);
create index if not exists stories_state_view_idx on stories(workspace_id, portfolio_lane, current_triage_decision, research_state);
create index if not exists legacy_payload_checksum_idx on legacy_import_payloads(checksum);
create index if not exists legacy_payload_batch_status_idx on legacy_import_payloads(migration_batch_id, migration_status);
create index if not exists story_source_links_batch_idx on story_source_links(migration_batch_id) where migration_batch_id is not null;
create index if not exists activity_events_batch_idx on activity_events(migration_batch_id) where migration_batch_id is not null;

create or replace function forbid_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.allow_audit_mutation', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'append-only table % rejects direct %', tg_table_name, tg_op;
end;
$$;

drop trigger if exists activity_events_append_only on activity_events;
create trigger activity_events_append_only before update or delete on activity_events for each row execute function forbid_audit_mutation();
drop trigger if exists editorial_decisions_append_only on editorial_decisions;
create trigger editorial_decisions_append_only before update or delete on editorial_decisions for each row execute function forbid_audit_mutation();
drop trigger if exists ingestion_runs_append_only on ingestion_runs;
create trigger ingestion_runs_append_only before update or delete on ingestion_runs for each row execute function forbid_audit_mutation();
drop trigger if exists migration_batches_append_only on migration_batches;
create trigger migration_batches_append_only before update or delete on migration_batches for each row execute function forbid_audit_mutation();
drop trigger if exists legacy_import_payloads_append_only on legacy_import_payloads;
create trigger legacy_import_payloads_append_only before update or delete on legacy_import_payloads for each row execute function forbid_audit_mutation();

create or replace function finalize_migration_batch(
  p_batch_id uuid,
  p_status migration_status,
  p_imported_counts jsonb,
  p_duplicate_counts jsonb,
  p_unmapped_counts jsonb,
  p_error_summary text default null
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.allow_audit_mutation', 'on', true);
  update migration_batches
    set status = p_status,
        completed_at = now(),
        imported_counts = p_imported_counts,
        duplicate_counts = p_duplicate_counts,
        unmapped_counts = p_unmapped_counts,
        error_summary = p_error_summary
    where id = p_batch_id;
end;
$$;

revoke all on function finalize_migration_batch(uuid, migration_status, jsonb, jsonb, jsonb, text) from public;
grant execute on function finalize_migration_batch(uuid, migration_status, jsonb, jsonb, jsonb, text) to service_role;

create or replace function import_legacy_story_payload(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_migration_batch_id uuid,
  p_legacy_source_system text,
  p_legacy_record_id text,
  p_payload jsonb,
  p_checksum text,
  p_portfolio_lane portfolio_lane
)
returns jsonb
language plpgsql
as $$
declare
  v_existing_story_id uuid;
  v_story_object_id uuid := gen_random_uuid();
  v_source_object_id uuid;
  v_story_id uuid;
  v_source_id uuid;
  v_article jsonb;
  v_url text;
  v_title text;
  v_publisher text;
  v_triage triage_decision;
begin
  select canonical_story_id into v_existing_story_id
  from legacy_import_payloads
  where migration_batch_id = p_migration_batch_id
    and legacy_source_system = p_legacy_source_system
    and legacy_record_id = p_legacy_record_id;

  if v_existing_story_id is not null then
    return jsonb_build_object('story_id', v_existing_story_id, 'status', 'already_imported');
  end if;

  if p_portfolio_lane = 'archive' then
    v_triage := 'bad';
  elsif p_portfolio_lane = 'story_bank' then
    v_triage := 'maybe';
  else
    v_triage := 'unreviewed';
  end if;

  insert into newsroom_objects(id, workspace_id, object_type, created_by_actor_id, system_generated)
  values (v_story_object_id, p_workspace_id, 'story', p_actor_id, true);

  insert into stories(
    newsroom_object_id,
    workspace_id,
    migration_batch_id,
    canonical_headline,
    short_description,
    story_type,
    discovery_timestamp,
    current_freshness_state,
    intake_state,
    portfolio_lane,
    research_state,
    current_triage_decision,
    candidate_key,
    legacy_import_summary,
    created_by_actor_id,
    archived_at
  )
  values (
    v_story_object_id,
    p_workspace_id,
    p_migration_batch_id,
    coalesce(p_payload->>'title', 'Untitled legacy Story'),
    coalesce(p_payload->>'real_story', ''),
    coalesce(p_payload->>'domain', 'Other'),
    coalesce(nullif(p_payload->>'created_at', '')::timestamptz, now()),
    coalesce(p_payload->>'freshness_status', 'Stable'),
    'triaged',
    p_portfolio_lane,
    'not_started',
    v_triage,
    regexp_replace(lower(coalesce(p_payload->>'title', p_legacy_record_id) || '-' || coalesce(p_payload->>'story_arc', '')), '[^a-z0-9]+', '-', 'g'),
    p_payload,
    p_actor_id,
    case when p_portfolio_lane = 'archive' then now() else null end
  )
  returning id into v_story_id;

  insert into legacy_import_payloads(
    workspace_id,
    migration_batch_id,
    canonical_story_id,
    legacy_source_system,
    legacy_record_id,
    payload,
    checksum,
    migration_status,
    resolution_notes
  )
  values (
    p_workspace_id,
    p_migration_batch_id,
    v_story_id,
    p_legacy_source_system,
    p_legacy_record_id,
    p_payload,
    p_checksum,
    'resolved',
    'Imported legacy state; original rationale unavailable where not present.'
  );

  for v_article in select * from jsonb_array_elements(coalesce(p_payload->'articles', '[]'::jsonb)) loop
    v_url := nullif(v_article->>'url', '');
    v_title := coalesce(v_article->>'title', 'Untitled source');
    v_publisher := coalesce(v_article->>'source', 'Unknown');

    if v_url is not null then
      select id into v_source_id
      from source_material
      where workspace_id = p_workspace_id
        and canonical_url = v_url
      limit 1;
    else
      v_source_id := null;
    end if;

    if v_source_id is null then
      v_source_object_id := gen_random_uuid();
      insert into newsroom_objects(id, workspace_id, object_type, created_by_actor_id, system_generated)
      values (v_source_object_id, p_workspace_id, 'source_material', p_actor_id, true);

      insert into source_material(
        newsroom_object_id,
        workspace_id,
        migration_batch_id,
        source_type,
        publisher_name,
        canonical_url,
        original_url,
        normalized_title,
        title,
        discovered_at,
        content_excerpt,
        content_hash
      )
      values (
        v_source_object_id,
        p_workspace_id,
        p_migration_batch_id,
        'article',
        v_publisher,
        v_url,
        v_url,
        lower(trim(v_title)),
        v_title,
        coalesce(nullif(v_article->>'found_at', '')::timestamptz, nullif(p_payload->>'created_at', '')::timestamptz, now()),
        coalesce(v_article->>'summary', ''),
        encode(digest(v_article::text, 'sha256'), 'hex')
      )
      returning id into v_source_id;
    end if;

    insert into story_source_links(story_id, source_material_id, migration_batch_id, relationship_type, linked_by_actor_id, notes)
    values (v_story_id, v_source_id, p_migration_batch_id, 'primary', p_actor_id, 'Imported from legacy Jimmy payload.')
    on conflict (story_id, source_material_id, relationship_type) do nothing;
  end loop;

  insert into activity_events(workspace_id, subject_object_id, migration_batch_id, event_type, actor_id, metadata)
  values (
    p_workspace_id,
    v_story_object_id,
    p_migration_batch_id,
    'legacy_state_imported',
    p_actor_id,
    jsonb_build_object(
      'legacy_source_system', p_legacy_source_system,
      'legacy_status', coalesce(p_payload->>'status', p_portfolio_lane::text),
      'rationale', coalesce(
        p_payload->>'why_it_cannot_be_ignored',
        p_payload->>'score_reasoning',
        'Imported legacy state; original rationale unavailable'
      )
    )
  );

  return jsonb_build_object('story_id', v_story_id, 'status', 'imported');
end;
$$;

revoke all on function import_legacy_story_payload(uuid, uuid, uuid, text, text, jsonb, text, portfolio_lane) from public;
grant execute on function import_legacy_story_payload(uuid, uuid, uuid, text, text, jsonb, text, portfolio_lane) to service_role;

create or replace function legacy_table_count(p_table_name text)
returns integer
language plpgsql
stable
as $$
declare
  v_count integer := 0;
begin
  if to_regclass('public.' || p_table_name) is null then
    return 0;
  end if;

  execute format('select count(*)::integer from public.%I', p_table_name)
    into v_count;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function legacy_table_count(text) from public;
grant execute on function legacy_table_count(text) to service_role;

create or replace function import_live_jimmy_legacy(p_dry_run boolean default true)
returns jsonb
language plpgsql
as $$
declare
  v_workspace_id uuid;
  v_actor_id uuid;
  v_batch_id uuid;
  v_source_object_id uuid;
  v_source_config_id uuid;
  v_ingestion_run_object_id uuid;
  v_ingestion_run_id uuid;
  v_source_object_id_for_item uuid;
  v_source_material_id uuid;
  v_was_duplicate boolean;
  v_row jsonb;
  v_payload jsonb;
  v_checksum text;
  v_legacy_id text;
  v_table_name text;
  v_lane portfolio_lane;
  v_url text;
  v_title text;
  v_imported_story_bank integer := 0;
  v_imported_story_archive integer := 0;
  v_imported_memory integer := 0;
  v_duplicate_memory integer := 0;
  v_malformed integer := 0;
  v_result jsonb;
begin
  select id into v_workspace_id from workspaces where slug = 'gamesmith-news';
  if v_workspace_id is null then
    raise exception 'Gamesmith workspace has not been seeded';
  end if;

  select id into v_actor_id
  from actors
  where workspace_id = v_workspace_id
    and display_name = 'Gamesmith Import System'
    and actor_type = 'system';
  if v_actor_id is null then
    raise exception 'Gamesmith import actor has not been seeded';
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true,
      'legacy_counts', jsonb_build_object(
        'jimmy_memory', legacy_table_count('jimmy_memory'),
        'story_bank', legacy_table_count('story_bank'),
        'story_archive', legacy_table_count('story_archive'),
        'daily_runs', legacy_table_count('daily_runs'),
        'watch_list', legacy_table_count('watch_list')
      ),
      'note', 'No rows were changed.'
    );
  end if;

  insert into migration_batches(
    source_system,
    migration_version,
    dry_run,
    status,
    initiated_by_actor_id
  )
  values (
    'live-jimmy-production',
    'phase1-canonical-newsroom-20260628',
    false,
    'running',
    v_actor_id
  )
  returning id into v_batch_id;

  select id into v_source_config_id
  from source_registry_configs
  where workspace_id = v_workspace_id
    and source_name = 'Legacy Jimmy Production Import';

  if v_source_config_id is null then
    v_source_object_id := gen_random_uuid();
    insert into newsroom_objects(id, workspace_id, object_type, created_by_actor_id, system_generated)
    values (v_source_object_id, v_workspace_id, 'source_registry_config', v_actor_id, true);

    insert into source_registry_configs(
      newsroom_object_id,
      workspace_id,
      migration_batch_id,
      source_name,
      feed_url,
      source_type,
      source_role,
      active,
      priority,
      reliability_tier,
      polling_config,
      configuration_checksum
    )
    values (
      v_source_object_id,
      v_workspace_id,
      v_batch_id,
      'Legacy Jimmy Production Import',
      'legacy:live-jimmy-production',
      'legacy_import',
      'migration',
      false,
      999,
      null,
      jsonb_build_object('managed_by', 'phase1_migration'),
      encode(digest('legacy:live-jimmy-production', 'sha256'), 'hex')
    )
    returning id into v_source_config_id;
  end if;

  foreach v_table_name in array array['story_bank', 'story_archive'] loop
    if to_regclass('public.' || v_table_name) is null then
      continue;
    end if;

    if v_table_name = 'story_bank' then
      v_lane := 'story_bank';
    else
      v_lane := 'archive';
    end if;

    for v_row in execute format('select to_jsonb(t) from public.%I t', v_table_name) loop
      if jsonb_typeof(v_row->'story') = 'object' then
        v_payload := v_row->'story';
      elsif jsonb_typeof(v_row->'payload') = 'object' then
        v_payload := v_row->'payload';
      else
        v_payload := v_row;
      end if;

      v_checksum := encode(digest(v_row::text, 'sha256'), 'hex');
      v_legacy_id := coalesce(
        nullif(v_row->>'id', ''),
        nullif(v_payload->>'id', ''),
        nullif(v_payload->>'story_id', ''),
        v_checksum
      );

      if coalesce(nullif(v_payload->>'title', ''), nullif(v_payload->>'story_title', '')) is null then
        v_malformed := v_malformed + 1;
        insert into legacy_import_payloads(
          workspace_id,
          migration_batch_id,
          legacy_source_system,
          legacy_record_id,
          payload,
          checksum,
          migration_status,
          resolution_notes
        )
        values (
          v_workspace_id,
          v_batch_id,
          v_table_name,
          v_legacy_id,
          v_row,
          v_checksum,
          'malformed',
          'Legacy record could not be resolved to a canonical Story title.'
        )
        on conflict (legacy_source_system, legacy_record_id, migration_batch_id) do nothing;
        continue;
      end if;

      v_result := import_legacy_story_payload(
        v_workspace_id,
        v_actor_id,
        v_batch_id,
        v_table_name,
        v_legacy_id,
        v_payload,
        v_checksum,
        v_lane
      );

      if v_result->>'status' = 'imported' then
        if v_table_name = 'story_bank' then
          v_imported_story_bank := v_imported_story_bank + 1;
        else
          v_imported_story_archive := v_imported_story_archive + 1;
        end if;
      end if;
    end loop;
  end loop;

  if to_regclass('public.jimmy_memory') is not null then
    v_ingestion_run_object_id := gen_random_uuid();
    insert into newsroom_objects(id, workspace_id, object_type, created_by_actor_id, system_generated)
    values (v_ingestion_run_object_id, v_workspace_id, 'ingestion_run', v_actor_id, true);

    insert into ingestion_runs(
      newsroom_object_id,
      workspace_id,
      migration_batch_id,
      run_type,
      triggered_by_actor_id,
      status,
      source_count
    )
    values (
      v_ingestion_run_object_id,
      v_workspace_id,
      v_batch_id,
      'legacy_jimmy_memory_import',
      v_actor_id,
      'processed',
      legacy_table_count('jimmy_memory')
    )
    returning id into v_ingestion_run_id;

    for v_row in execute 'select to_jsonb(t) from public.jimmy_memory t' loop
      if jsonb_typeof(v_row->'story') = 'object' then
        v_payload := v_row->'story';
      elsif jsonb_typeof(v_row->'payload') = 'object' then
        v_payload := v_row->'payload';
      else
        v_payload := v_row;
      end if;

      v_checksum := encode(digest(v_row::text, 'sha256'), 'hex');
      v_url := coalesce(
        nullif(v_payload->>'url', ''),
        nullif(v_payload->>'canonical_url', ''),
        nullif(v_payload->>'primary_source', '')
      );
      v_title := coalesce(
        nullif(v_payload->>'title', ''),
        nullif(v_payload->>'story_title', ''),
        nullif(v_payload->>'headline', ''),
        'Legacy Jimmy memory item'
      );

      select id into v_source_material_id
      from source_material
      where workspace_id = v_workspace_id
        and (
          (v_url is not null and canonical_url = v_url)
          or content_hash = v_checksum
        )
      limit 1;

      v_was_duplicate := v_source_material_id is not null;

      if v_source_material_id is null then
        v_source_object_id_for_item := gen_random_uuid();
        insert into newsroom_objects(id, workspace_id, object_type, created_by_actor_id, system_generated)
        values (v_source_object_id_for_item, v_workspace_id, 'source_material', v_actor_id, true);

        insert into source_material(
          newsroom_object_id,
          workspace_id,
          source_registry_config_id,
          first_ingestion_run_id,
          migration_batch_id,
          source_type,
          publisher_name,
          external_source_id,
          canonical_url,
          original_url,
          normalized_title,
          title,
          discovered_at,
          content_excerpt,
          content_hash
        )
        values (
          v_source_object_id_for_item,
          v_workspace_id,
          v_source_config_id,
          v_ingestion_run_id,
          v_batch_id,
          'legacy_memory',
          coalesce(nullif(v_payload->>'source', ''), 'Jimmy Memory'),
          nullif(v_row->>'id', ''),
          v_url,
          v_url,
          lower(trim(v_title)),
          v_title,
          now(),
          coalesce(v_payload->>'summary', v_payload::text),
          v_checksum
        )
        returning id into v_source_material_id;

        v_imported_memory := v_imported_memory + 1;
      else
        v_duplicate_memory := v_duplicate_memory + 1;
      end if;

      insert into ingestion_items(
        ingestion_run_id,
        source_registry_config_id,
        source_material_id,
        migration_batch_id,
        discovered_url,
        external_source_id,
        raw_payload,
        duplicate_outcome,
        story_outcome,
        processing_status
      )
      values (
        v_ingestion_run_id,
        v_source_config_id,
        v_source_material_id,
        v_batch_id,
        v_url,
        nullif(v_row->>'id', ''),
        v_row,
        case when v_was_duplicate then 'duplicate_source'::duplicate_outcome else 'new_source'::duplicate_outcome end,
        'none',
        'processed'
      );
    end loop;
  end if;

  perform finalize_migration_batch(
    v_batch_id,
    case when v_malformed > 0 then 'partial'::migration_status else 'succeeded'::migration_status end,
    jsonb_build_object(
      'story_bank', v_imported_story_bank,
      'story_archive', v_imported_story_archive,
      'jimmy_memory_source_material', v_imported_memory
    ),
    jsonb_build_object(
      'jimmy_memory_duplicate_source_material', v_duplicate_memory
    ),
    jsonb_build_object(
      'malformed_legacy_stories', v_malformed
    ),
    case when v_malformed > 0 then 'One or more legacy story records were malformed.' else null end
  );

  return jsonb_build_object(
    'dry_run', false,
    'migration_batch_id', v_batch_id,
    'imported_counts', jsonb_build_object(
      'story_bank', v_imported_story_bank,
      'story_archive', v_imported_story_archive,
      'jimmy_memory_source_material', v_imported_memory
    ),
    'duplicate_counts', jsonb_build_object(
      'jimmy_memory_duplicate_source_material', v_duplicate_memory
    ),
    'unmapped_counts', jsonb_build_object(
      'malformed_legacy_stories', v_malformed
    )
  );
end;
$$;

revoke all on function import_live_jimmy_legacy(boolean) from public;
grant execute on function import_live_jimmy_legacy(boolean) to service_role;

create or replace function prevent_story_merge_cycle()
returns trigger
language plpgsql
as $$
declare
  cursor_id uuid;
begin
  if new.merged_into_story_id is null then
    return new;
  end if;

  cursor_id := new.merged_into_story_id;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'story merge cycle detected for %', new.id;
    end if;
    select merged_into_story_id into cursor_id from stories where id = cursor_id;
  end loop;

  return new;
end;
$$;

drop trigger if exists stories_prevent_merge_cycle on stories;
create trigger stories_prevent_merge_cycle before insert or update of merged_into_story_id on stories for each row execute function prevent_story_merge_cycle();

create or replace function validate_story_state()
returns trigger
language plpgsql
as $$
begin
  if new.current_triage_decision = 'maybe' and new.portfolio_lane <> 'story_bank' then
    raise exception 'MAYBE stories must be in story_bank';
  end if;
  if new.current_triage_decision = 'bad' and new.portfolio_lane <> 'archive' then
    raise exception 'BAD stories must be in archive';
  end if;
  if new.current_triage_decision = 'good' and new.portfolio_lane not in ('active', 'gem') then
    raise exception 'GOOD stories must be active or gem';
  end if;
  if new.portfolio_lane = 'story_bank' and new.research_state <> 'not_started' then
    raise exception 'Story Bank stories must not have active research state';
  end if;
  return new;
end;
$$;

drop trigger if exists stories_validate_state on stories;
create trigger stories_validate_state before insert or update on stories for each row execute function validate_story_state();

create or replace function transition_story_triage(
  p_story_id uuid,
  p_actor_id uuid,
  p_outcome triage_decision,
  p_rationale text
)
returns jsonb
language plpgsql
as $$
declare
  v_story stories%rowtype;
  v_previous jsonb;
  v_new jsonb;
  v_decision_object_id uuid := gen_random_uuid();
  v_work_object_id uuid;
  v_decision_id uuid;
  v_work_item_id uuid;
  v_workspace_id uuid;
  v_jenny_department_id uuid;
begin
  select * into v_story from stories where id = p_story_id for update;
  if not found then
    raise exception 'Story not found: %', p_story_id;
  end if;

  if v_story.merged_into_story_id is not null then
    raise exception 'Merged stories cannot be triaged directly';
  end if;

  v_workspace_id := v_story.workspace_id;
  v_previous := jsonb_build_object(
    'intake_state', v_story.intake_state,
    'current_triage_decision', v_story.current_triage_decision,
    'portfolio_lane', v_story.portfolio_lane,
    'research_state', v_story.research_state,
    'merged_into_story_id', v_story.merged_into_story_id
  );

  if p_outcome = 'good' then
    update stories
      set intake_state = 'triaged',
          current_triage_decision = 'good',
          portfolio_lane = 'active',
          research_state = 'not_started',
          updated_at = now()
      where id = p_story_id;
  elsif p_outcome = 'maybe' then
    update stories
      set intake_state = 'triaged',
          current_triage_decision = 'maybe',
          portfolio_lane = 'story_bank',
          research_state = 'not_started',
          updated_at = now()
      where id = p_story_id;
  elsif p_outcome = 'bad' then
    update stories
      set intake_state = 'triaged',
          current_triage_decision = 'bad',
          portfolio_lane = 'archive',
          research_state = 'not_started',
          archived_at = coalesce(archived_at, now()),
          updated_at = now()
      where id = p_story_id;
  else
    raise exception 'Unsupported triage outcome: %', p_outcome;
  end if;

  insert into newsroom_objects(id, workspace_id, object_type, created_by_actor_id, system_generated)
  values (v_decision_object_id, v_workspace_id, 'editorial_decision', p_actor_id, false);

  insert into editorial_decisions(newsroom_object_id, workspace_id, subject_object_id, decision_type, outcome, decision_rationale, decided_by_actor_id)
  values (v_decision_object_id, v_workspace_id, v_story.newsroom_object_id, 'story_triage', p_outcome::text, p_rationale, p_actor_id)
  returning id into v_decision_id;

  if p_outcome = 'good' then
    select id into v_jenny_department_id from departments where workspace_id = v_workspace_id and code = 'jenny';
    if v_jenny_department_id is not null then
      v_work_object_id := gen_random_uuid();
      insert into newsroom_objects(id, workspace_id, object_type, created_by_actor_id, system_generated)
      values (v_work_object_id, v_workspace_id, 'work_item', p_actor_id, true);

      insert into work_items(newsroom_object_id, workspace_id, subject_object_id, work_type, owning_department_id, status, priority, created_by_actor_id)
      values (v_work_object_id, v_workspace_id, v_story.newsroom_object_id, 'research', v_jenny_department_id, 'new', 'normal', p_actor_id)
      returning id into v_work_item_id;
    end if;
  end if;

  select jsonb_build_object(
    'intake_state', intake_state,
    'current_triage_decision', current_triage_decision,
    'portfolio_lane', portfolio_lane,
    'research_state', research_state,
    'merged_into_story_id', merged_into_story_id
  ) into v_new
  from stories where id = p_story_id;

  insert into activity_events(workspace_id, subject_object_id, event_type, actor_id, previous_state, new_state, metadata)
  values (v_workspace_id, v_story.newsroom_object_id, 'story_triaged', p_actor_id, v_previous, v_new, jsonb_build_object('decision_id', v_decision_id, 'work_item_id', v_work_item_id));

  return jsonb_build_object('story_id', p_story_id, 'decision_id', v_decision_id, 'work_item_id', v_work_item_id);
end;
$$;

revoke all on function transition_story_triage(uuid, uuid, triage_decision, text) from public;
grant execute on function transition_story_triage(uuid, uuid, triage_decision, text) to service_role;

alter table workspaces enable row level security;
alter table actors enable row level security;
alter table workspace_memberships enable row level security;
alter table departments enable row level security;
alter table newsroom_objects enable row level security;
alter table migration_batches enable row level security;
alter table source_registry_configs enable row level security;
alter table ingestion_runs enable row level security;
alter table ingestion_items enable row level security;
alter table source_material enable row level security;
alter table stories enable row level security;
alter table story_source_links enable row level security;
alter table subjects enable row level security;
alter table story_subjects enable row level security;
alter table story_relations enable row level security;
alter table legacy_import_payloads enable row level security;
alter table editorial_decisions enable row level security;
alter table work_items enable row level security;
alter table activity_events enable row level security;

create or replace function is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from workspace_memberships
    where workspace_id = p_workspace_id
      and auth_user_id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke all on function is_workspace_member(uuid) from public;
grant execute on function is_workspace_member(uuid) to authenticated;

do $$ begin
  create policy "workspace members can read workspaces" on workspaces for select to authenticated using (is_workspace_member(id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "workspace members can read actors" on actors for select to authenticated using (is_workspace_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "workspace members can read memberships" on workspace_memberships for select to authenticated using (is_workspace_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "workspace members can read departments" on departments for select to authenticated using (is_workspace_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "workspace members can read newsroom objects" on newsroom_objects for select to authenticated using (is_workspace_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "workspace members can read stories" on stories for select to authenticated using (is_workspace_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "workspace members can read source material" on source_material for select to authenticated using (is_workspace_member(workspace_id));
exception when duplicate_object then null; end $$;

insert into workspaces(name, slug)
values ('Gamesmith News', 'gamesmith-news')
on conflict (slug) do nothing;

with ws as (
  select id from workspaces where slug = 'gamesmith-news'
)
insert into actors(workspace_id, actor_type, display_name)
select id, 'system', 'Gamesmith Import System' from ws
on conflict (workspace_id, display_name, actor_type) do nothing;

with ws as (
  select id from workspaces where slug = 'gamesmith-news'
)
insert into actors(workspace_id, actor_type, display_name)
select id, 'human', 'William' from ws
on conflict (workspace_id, display_name, actor_type) do nothing;

with ws as (
  select id from workspaces where slug = 'gamesmith-news'
)
insert into actors(workspace_id, actor_type, display_name)
select id, 'agent', 'Jimmy' from ws
on conflict (workspace_id, display_name, actor_type) do nothing;

with ws as (select id from workspaces where slug = 'gamesmith-news')
insert into departments(workspace_id, name, code)
select ws.id, d.name, d.code
from ws
cross join (values
  ('Jimmy - Assignment Desk', 'jimmy'),
  ('Jenny - Research Desk', 'jenny'),
  ('Emma - Executive Story Producer', 'emma'),
  ('Sam - Script Department', 'sam'),
  ('Sally - Graphics', 'sally'),
  ('Penny - Production', 'penny'),
  ('Lois - Asset Collection', 'lois'),
  ('Clark - Publishing', 'clark'),
  ('Charlie - Analytics', 'charlie')
) as d(name, code)
on conflict (workspace_id, code) do nothing;
