import { StoryPackage } from "@/agents/jimmy/types-package";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { StoryEvent } from "@/lib/types";
import { RequestActorContext, WorkspaceContext } from "./identity";
import {
  candidateKeyForPackage,
  canonicalStoryToStoryEvent,
  checksumPayload,
  normalizeTitle,
  packageLegacySummary,
  slugify,
  CanonicalStoryRow,
} from "./storyMapping";
import {
  assertTriageTransition,
  triageRationale,
  TriageOutcome,
} from "./storyState";

async function createNewsroomObject(
  context: WorkspaceContext,
  objectType: string,
  systemGenerated = false
) {
  const { data, error } = await supabaseAdmin
    .from("newsroom_objects")
    .insert({
      workspace_id: context.workspaceId,
      object_type: objectType,
      created_by_actor_id: context.actorId,
      system_generated: systemGenerated,
    })
    .select("id")
    .single();

  if (error || !data) throw error || new Error("Failed to create object.");

  return data.id as string;
}

async function findOrCreateSourceConfig(
  context: WorkspaceContext,
  sourceName: string
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("source_registry_configs")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("source_name", sourceName)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const objectId = await createNewsroomObject(
    context,
    "source_registry_config",
    true
  );
  const fallbackConfig = {
    source_name: sourceName,
    feed_url: `unconfigured:${slugify(sourceName)}`,
    source_type: "legacy_import",
  };

  const { data, error } = await supabaseAdmin
    .from("source_registry_configs")
    .insert({
      newsroom_object_id: objectId,
      workspace_id: context.workspaceId,
      source_name: sourceName,
      feed_url: fallbackConfig.feed_url,
      source_type: fallbackConfig.source_type,
      source_role: "discovery",
      active: false,
      priority: 999,
      reliability_tier: null,
      polling_config: { needs_configuration: true },
      configuration_checksum: checksumPayload(fallbackConfig),
    })
    .select("id")
    .single();

  if (error || !data) throw error || new Error("Failed to create source config.");

  return data.id as string;
}

async function createCompatibilityBatch(context: WorkspaceContext) {
  const { data, error } = await supabaseAdmin
    .from("migration_batches")
    .insert({
      source_system: "jimmy-api-compatibility",
      migration_version: "phase1-live-package",
      dry_run: false,
      status: "succeeded",
      imported_counts: { packages: 1 },
      duplicate_counts: {},
      unmapped_counts: {},
      completed_at: new Date().toISOString(),
      initiated_by_actor_id: context.actorId,
    })
    .select("id")
    .single();

  if (error || !data) throw error || new Error("Failed to create import batch.");

  return data.id as string;
}

async function findOrCreateStoryFromPackage(
  context: WorkspaceContext,
  storyPackage: StoryPackage
) {
  const checksum = checksumPayload(storyPackage);
  const legacyRecordId = slugify(storyPackage.story_title);

  const { data: existingPayload } = await supabaseAdmin
    .from("legacy_import_payloads")
    .select("canonical_story_id")
    .eq("legacy_source_system", "jimmy")
    .eq("checksum", checksum)
    .not("canonical_story_id", "is", null)
    .maybeSingle();

  if (existingPayload?.canonical_story_id) {
    return existingPayload.canonical_story_id as string;
  }

  const candidateKey = candidateKeyForPackage(storyPackage);
  const { data: existingStory } = await supabaseAdmin
    .from("stories")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("candidate_key", candidateKey)
    .is("merged_into_story_id", null)
    .maybeSingle();

  const batchId = await createCompatibilityBatch(context);

  let storyId = existingStory?.id as string | undefined;

  if (!storyId) {
    const storyObjectId = await createNewsroomObject(context, "story", true);
    const { data: story, error: storyError } = await supabaseAdmin
      .from("stories")
      .insert({
        newsroom_object_id: storyObjectId,
        workspace_id: context.workspaceId,
        migration_batch_id: batchId,
        canonical_headline: storyPackage.story_title,
        short_description: storyPackage.real_story || storyPackage.summary,
        story_type: storyPackage.gamesmith_story_type,
        discovery_timestamp: new Date().toISOString(),
        current_freshness_state: storyPackage.freshness_status,
        intake_state: "unreviewed",
        portfolio_lane: "assignment_desk",
        research_state: "not_started",
        current_triage_decision: "unreviewed",
        candidate_key: candidateKey,
        legacy_import_summary: packageLegacySummary(storyPackage),
        created_by_actor_id: context.actorId,
      })
      .select("id,newsroom_object_id")
      .single();

    if (storyError || !story) {
      throw storyError || new Error("Failed to create canonical Story.");
    }

    storyId = story.id as string;

    await supabaseAdmin.from("activity_events").insert({
      workspace_id: context.workspaceId,
      subject_object_id: story.newsroom_object_id,
      event_type: "story_created",
      actor_id: context.actorId,
      metadata: { source: "jimmy-api-compatibility" },
    });
  }

  const { error: payloadError } = await supabaseAdmin
    .from("legacy_import_payloads")
    .insert({
      workspace_id: context.workspaceId,
      migration_batch_id: batchId,
      canonical_story_id: storyId,
      legacy_source_system: "jimmy",
      legacy_record_id: legacyRecordId,
      payload: storyPackage,
      checksum,
      migration_status: "resolved",
      resolution_notes: "Imported from Jimmy API compatibility route.",
    });

  if (payloadError) throw payloadError;

  for (const article of storyPackage.articles || []) {
    const url = article.url || "";
    const title = article.title || "Untitled Source";

    const { data: existingSource } = url
      ? await supabaseAdmin
          .from("source_material")
          .select("id")
          .eq("workspace_id", context.workspaceId)
          .eq("canonical_url", url)
          .maybeSingle()
      : { data: null };

    let sourceId = existingSource?.id as string | undefined;

    if (!sourceId) {
      const sourceObjectId = await createNewsroomObject(
        context,
        "source_material",
        true
      );

      const { data: source, error: sourceError } = await supabaseAdmin
        .from("source_material")
        .insert({
          newsroom_object_id: sourceObjectId,
          workspace_id: context.workspaceId,
          migration_batch_id: batchId,
          source_type: "article",
          publisher_name: article.source,
          canonical_url: url || null,
          original_url: url || null,
          normalized_title: normalizeTitle(title),
          title,
          discovered_at: new Date().toISOString(),
          content_excerpt: article.summary || "",
          content_hash: checksumPayload({
            title,
            source: article.source,
            summary: article.summary || "",
          }),
        })
        .select("id")
        .single();

      if (sourceError || !source) {
        throw sourceError || new Error("Failed to create Source Material.");
      }

      sourceId = source.id as string;
    }

    const { error: linkError } = await supabaseAdmin
      .from("story_source_links")
      .upsert(
        {
          story_id: storyId,
          source_material_id: sourceId,
          relationship_type: "primary",
          linked_by_actor_id: context.actorId,
          notes: "Linked from Jimmy package import.",
        },
        { onConflict: "story_id,source_material_id,relationship_type" }
      );

    if (linkError) throw linkError;
  }

  return storyId;
}

export async function recordJimmyIntake(
  context: WorkspaceContext,
  packages: StoryPackage[],
  runType: "manual" | "scheduled" = "manual"
) {
  const startedAt = new Date().toISOString();
  const storyIds: string[] = [];
  const sourceItems = packages.flatMap((storyPackage) =>
    (storyPackage.articles || []).map((article) => ({ storyPackage, article }))
  );

  for (const storyPackage of packages) {
    storyIds.push(await findOrCreateStoryFromPackage(context, storyPackage));
  }

  const runObjectId = await createNewsroomObject(context, "ingestion_run", true);
  const { data: run, error: runError } = await supabaseAdmin
    .from("ingestion_runs")
    .insert({
      newsroom_object_id: runObjectId,
      workspace_id: context.workspaceId,
      run_type: runType,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: "succeeded",
      source_count: new Set(sourceItems.map((item) => item.article.source)).size,
      source_item_count: sourceItems.length,
      duplicate_count: 0,
      story_count: storyIds.length,
      triggered_by_actor_id: context.actorId,
    })
    .select("id")
    .single();

  if (runError || !run) {
    throw runError || new Error("Failed to create ingestion run.");
  }

  for (const { storyPackage, article } of sourceItems) {
    const storyId = storyIds[packages.indexOf(storyPackage)];
    const sourceConfigId = await findOrCreateSourceConfig(
      context,
      article.source || "Unknown"
    );
    const { data: source } = article.url
      ? await supabaseAdmin
          .from("source_material")
          .select("id")
          .eq("workspace_id", context.workspaceId)
          .eq("canonical_url", article.url)
          .maybeSingle()
      : { data: null };

    await supabaseAdmin.from("ingestion_items").insert({
      workspace_id: context.workspaceId,
      ingestion_run_id: run.id,
      source_registry_config_id: sourceConfigId,
      source_material_id: source?.id || null,
      story_id: storyId,
      discovered_at: new Date().toISOString(),
      discovered_url: article.url || null,
      raw_title: article.title || null,
      raw_payload: article,
      duplicate_outcome: source?.id ? "duplicate_source" : "new_source",
      story_outcome: "linked_existing_story",
      processing_status: "processed",
    });
  }

  await supabaseAdmin.from("activity_events").insert({
    workspace_id: context.workspaceId,
    subject_object_id: runObjectId,
    event_type: "source_discovered",
    actor_id: context.actorId,
    metadata: {
      package_count: packages.length,
      source_item_count: sourceItems.length,
    },
  });

  return {
    ingestionRunId: run.id as string,
    storyIds,
    sourceItemCount: sourceItems.length,
  };
}

export async function transitionPackageTriage(
  context: RequestActorContext,
  storyPackage: StoryPackage,
  outcome: TriageOutcome,
  rationale?: string
) {
  const storyId = await findOrCreateStoryFromPackage(context, storyPackage);

  return transitionStoryTriage(context, storyId, outcome, rationale);
}

export async function transitionStoryTriage(
  context: RequestActorContext,
  storyId: string,
  outcome: TriageOutcome,
  rationale?: string
) {
  const { data: story, error } = await supabaseAdmin
    .from("stories")
    .select(
      "intake_state,current_triage_decision,portfolio_lane,research_state,merged_into_story_id"
    )
    .eq("id", storyId)
    .eq("workspace_id", context.workspaceId)
    .single();

  if (error || !story) throw error || new Error("Story not found.");

  assertTriageTransition(story, outcome);

  const { data, error: rpcError } = await supabaseAdmin.rpc(
    "transition_story_triage",
    {
      p_story_id: storyId,
      p_actor_id: context.actorId,
      p_outcome: outcome,
      p_rationale: triageRationale(outcome, rationale),
    }
  );

  if (rpcError) throw rpcError;

  return data;
}

export async function listStoryBank(): Promise<StoryEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("stories")
    .select(
      "id,canonical_headline,short_description,story_type,current_freshness_state,portfolio_lane,current_triage_decision,legacy_import_summary,created_at,updated_at,story_source_links(source_material(id,title,publisher_name,canonical_url,original_url,content_excerpt,discovered_at))"
    )
    .eq("portfolio_lane", "story_bank")
    .is("merged_into_story_id", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as unknown as CanonicalStoryRow[]).map(
    canonicalStoryToStoryEvent
  );
}

function cleanCell(value: unknown) {
  if (value === undefined || value === null) return "";

  return String(value)
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();
}

export async function exportStoryBankTSV() {
  const bank = await listStoryBank();
  const headers = [
    "Date Found",
    "Story Title",
    "Source Name",
    "Source URL",
    "Story Arc",
    "Story Type",
    "Hook",
    "Evidence Summary",
    "Review Status",
    "Approved?",
    "Editor Notes",
  ];

  const rows = bank.map((story) => {
    const sourceNames = Array.from(
      new Set(story.articles.map((article) => article.source))
    );
    const sourceUrls = Array.from(
      new Set(story.articles.map((article) => article.url || ""))
    );
    const evidenceSummary = story.articles
      .map((article) => `${article.source}: ${article.title}`)
      .join(" | ");

    return [
      story.created_at,
      story.title,
      sourceNames.join(" | "),
      sourceUrls.join(" | "),
      story.story_arc,
      story.domain,
      story.real_story,
      evidenceSummary,
      "Needs Review",
      "",
      "",
    ].map(cleanCell);
  });

  return [headers, ...rows].map((row) => row.join("\t")).join("\n");
}
