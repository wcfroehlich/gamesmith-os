import { createHash } from "crypto";
import fs from "fs";
import path from "path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const dryRun = !apply || args.has("--dry-run");
const migrationVersion = "phase1-canonical-newsroom-20260628";
const PRODUCTION_PROJECT_REF = "auzjilvjqjblgysargum";

function readJson(relativePath, fallback) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function checksum(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function classifyLegacyStory(story, sourceName) {
  const hasSources = Array.isArray(story.articles) && story.articles.length > 0;
  const actionableSources = hasSources && story.articles.some((item) => item.url);
  const malformed = !story.id || !story.title;
  const unknownArchiveRationale =
    sourceName === "story_archive" &&
    !(story.why_it_cannot_be_ignored || story.score_reasoning);

  if (malformed) return "malformed";
  if (!hasSources) return "importedStoriesWithNoSourceMaterial";
  if (sourceName === "story_bank" && !actionableSources) {
    return "importedStoryBankNoActionableSourceLinks";
  }
  if (unknownArchiveRationale) return "importedArchiveUnknownRationale";
  return "exactImports";
}

function buildReport() {
  const storyBank = readJson("data/story-bank.json", []);
  const storyArchive = readJson("data/story-archive.json", []);
  const jimmyMemory = readJson("data/jimmy-memory.json", []);
  const watchList = readJson("data/watch-list.json", []);
  const sourceConfigs = readJson("data/gamesmith-sources.json", []);

  const categories = {
    exactImports: [],
    deduplicatedImports: [],
    unresolvedImports: [],
    malformedImports: [],
    importedStoriesWithNoSourceMaterial: [],
    importedArchiveUnknownRationale: [],
    importedStoryBankNoActionableSourceLinks: [],
  };

  const seenChecksums = new Map();
  for (const [sourceName, stories] of [
    ["story_bank", storyBank],
    ["story_archive", storyArchive],
  ]) {
    for (const story of stories) {
      const digest = checksum(story);
      const item = { sourceName, legacyRecordId: story.id || null, checksum: digest };

      if (seenChecksums.has(digest)) {
        categories.deduplicatedImports.push(item);
        continue;
      }

      seenChecksums.set(digest, item);
      const classification = classifyLegacyStory(story, sourceName);

      if (classification === "malformed") {
        categories.malformedImports.push(item);
      } else {
        categories[classification].push(item);
      }
    }
  }

  return {
    dryRun,
    apply,
    migrationVersion,
    importedCounts: {
      story_bank: storyBank.length,
      story_archive: storyArchive.length,
      jimmy_memory: jimmyMemory.length,
      watch_list: watchList.length,
      source_registry_configs: sourceConfigs.length,
    },
    duplicateCounts: {
      legacy_payload_checksums: categories.deduplicatedImports.length,
    },
    unmappedCounts: {
      unresolved: categories.unresolvedImports.length,
      malformed: categories.malformedImports.length,
      stories_without_source_material:
        categories.importedStoriesWithNoSourceMaterial.length,
      archive_unknown_rationale: categories.importedArchiveUnknownRationale.length,
      bank_no_actionable_source_links:
        categories.importedStoryBankNoActionableSourceLinks.length,
    },
    categories,
  };
}

function requireSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const urlRef = new URL(url).host.split(".")[0];
  const envRef = process.env.SUPABASE_PROJECT_REF;
  if (urlRef === PRODUCTION_PROJECT_REF || envRef === PRODUCTION_PROJECT_REF) {
    throw new Error(
      "Refusing to import local fixture Story data into the Jimmy production project."
    );
  }

  console.log(`Fixture migration target Supabase project ref: ${envRef || urlRef}`);
  return { url, key };
}

async function one(client, table, values, columns = "id") {
  const { data, error } = await client.from(table).insert(values).select(columns).single();
  if (error) throw error;
  return data;
}

async function maybeOne(client, table, query) {
  let builder = client.from(table).select("*");
  for (const [column, value] of Object.entries(query)) {
    builder = builder.eq(column, value);
  }
  const { data, error } = await builder.maybeSingle();
  if (error) throw error;
  return data;
}

async function object(client, workspaceId, actorId, objectType) {
  return one(client, "newsroom_objects", {
    workspace_id: workspaceId,
    object_type: objectType,
    created_by_actor_id: actorId,
    system_generated: true,
  });
}

async function seedSourceConfigs(client, workspaceId, actorId, batchId) {
  const configs = readJson("data/gamesmith-sources.json", []);
  let imported = 0;

  for (const source of configs) {
    const existing = await maybeOne(client, "source_registry_configs", {
      workspace_id: workspaceId,
      source_name: source.name,
    });
    if (existing) continue;

    const obj = await object(client, workspaceId, actorId, "source_registry_config");
    await one(client, "source_registry_configs", {
      newsroom_object_id: obj.id,
      workspace_id: workspaceId,
      migration_batch_id: batchId,
      source_name: source.name,
      feed_url: source.url,
      source_type: source.source_type || "rss",
      source_role: source.source_role || null,
      active: Boolean(source.active),
      priority: Number(source.tier || 100),
      reliability_tier: Number(source.tier || 0),
      polling_config: {
        mission_fit: source.mission_fit || [],
        scan_frequency: source.scan_frequency || "daily",
        authority_score: source.authority_score,
        signal_score: source.signal_score,
        noise_score: source.noise_score,
      },
      configuration_checksum: checksum(source),
    });
    imported += 1;
  }

  return imported;
}

async function importLegacyStories(client, workspaceId, actorId, batchId, file, lane) {
  const stories = readJson(file, []);
  let imported = 0;

  for (const legacy of stories) {
    const payloadDigest = checksum(legacy);
    const { data, error } = await client.rpc("import_legacy_story_payload", {
      p_workspace_id: workspaceId,
      p_actor_id: actorId,
      p_migration_batch_id: batchId,
      p_legacy_source_system: file,
      p_legacy_record_id: legacy.id || payloadDigest,
      p_payload: legacy,
      p_checksum: payloadDigest,
      p_portfolio_lane: lane,
    });

    if (error) throw error;

    if (data?.status === "imported") imported += 1;
  }

  return imported;
}

async function applyMigration(report) {
  const { createClient } = await import("@supabase/supabase-js");
  const { url, key } = requireSupabase();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const workspace = await maybeOne(client, "workspaces", { slug: "gamesmith-news" });
  if (!workspace) throw new Error("Run schema migration before data import.");

  const actor = await maybeOne(client, "actors", {
    workspace_id: workspace.id,
    display_name: "Gamesmith Import System",
    actor_type: "system",
  });
  if (!actor) throw new Error("Import system actor has not been seeded.");

  const batch = await one(client, "migration_batches", {
    source_system: "legacy-jimmy",
    migration_version: migrationVersion,
    dry_run: false,
    status: "running",
    imported_counts: report.importedCounts,
    duplicate_counts: report.duplicateCounts,
    unmapped_counts: report.unmappedCounts,
    initiated_by_actor_id: actor.id,
  });

  const sourceConfigCount = await seedSourceConfigs(client, workspace.id, actor.id, batch.id);
  const bankCount = await importLegacyStories(
    client,
    workspace.id,
    actor.id,
    batch.id,
    "data/story-bank.json",
    "story_bank"
  );
  const archiveCount = await importLegacyStories(
    client,
    workspace.id,
    actor.id,
    batch.id,
    "data/story-archive.json",
    "archive"
  );

  const finalImportedCounts = {
    ...report.importedCounts,
    applied_source_registry_configs: sourceConfigCount,
    applied_story_bank: bankCount,
    applied_story_archive: archiveCount,
  };

  const { error: finalizeError } = await client.rpc("finalize_migration_batch", {
    p_batch_id: batch.id,
    p_status: "succeeded",
    p_imported_counts: finalImportedCounts,
    p_duplicate_counts: report.duplicateCounts,
    p_unmapped_counts: report.unmappedCounts,
    p_error_summary: null,
  });

  if (finalizeError) throw finalizeError;

  return {
    ...report,
    applied: {
      migration_batch_id: batch.id,
      source_registry_configs: sourceConfigCount,
      story_bank: bankCount,
      story_archive: archiveCount,
    },
  };
}

const report = buildReport();
const result = apply ? await applyMigration(report) : report;
console.log(JSON.stringify(result, null, 2));
