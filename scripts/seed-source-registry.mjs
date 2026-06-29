import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "auzjilvjqjblgysargum";
const root = process.cwd();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function checksum(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function readSources() {
  const fullPath = path.join(root, "data/gamesmith-sources.json");
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function projectRefFromUrl(url) {
  return new URL(url).host.split(".")[0];
}

function assertProductionTarget(url) {
  const envRef = process.env.SUPABASE_PROJECT_REF;
  const urlRef = projectRefFromUrl(url);
  const ref = envRef || urlRef;

  console.log(`Target Supabase project ref: ${ref}`);

  if (ref !== PRODUCTION_PROJECT_REF || urlRef !== PRODUCTION_PROJECT_REF) {
    throw new Error(
      `Refusing source seed: expected ${PRODUCTION_PROJECT_REF}, got env=${envRef || "(unset)"} url=${urlRef}.`
    );
  }
}

async function maybeSingle(query) {
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  assertProductionTarget(supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const workspace = await maybeSingle(
    supabase.from("workspaces").select("id").eq("slug", "gamesmith-news")
  );
  if (!workspace) throw new Error("Gamesmith workspace not found.");

  const actor = await maybeSingle(
    supabase
      .from("actors")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("display_name", "Gamesmith Import System")
      .eq("actor_type", "system")
  );
  if (!actor) throw new Error("Gamesmith import actor not found.");

  const { data: batch, error: batchError } = await supabase
    .from("migration_batches")
    .insert({
      source_system: "gamesmith-sources-json",
      migration_version: "phase1-source-registry-seed-20260628",
      dry_run: false,
      status: "running",
      initiated_by_actor_id: actor.id,
    })
    .select("id")
    .single();
  if (batchError) throw batchError;

  let created = 0;
  let updated = 0;

  for (const source of readSources()) {
    const existing = await maybeSingle(
      supabase
        .from("source_registry_configs")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("source_name", source.name)
    );

    const row = {
      migration_batch_id: batch.id,
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
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabase
        .from("source_registry_configs")
        .update(row)
        .eq("id", existing.id);
      if (error) throw error;
      updated += 1;
      continue;
    }

    const { data: object, error: objectError } = await supabase
      .from("newsroom_objects")
      .insert({
        workspace_id: workspace.id,
        object_type: "source_registry_config",
        created_by_actor_id: actor.id,
        system_generated: true,
      })
      .select("id")
      .single();
    if (objectError) throw objectError;

    const { error } = await supabase.from("source_registry_configs").insert({
      ...row,
      newsroom_object_id: object.id,
      workspace_id: workspace.id,
    });
    if (error) throw error;
    created += 1;
  }

  const { error: finalizeError } = await supabase.rpc("finalize_migration_batch", {
    p_batch_id: batch.id,
    p_status: "succeeded",
    p_imported_counts: { source_registry_configs_created: created },
    p_duplicate_counts: {},
    p_unmapped_counts: {},
    p_error_summary: null,
  });
  if (finalizeError) throw finalizeError;

  console.log(
    JSON.stringify(
      {
        ok: true,
        migration_batch_id: batch.id,
        source_registry_configs_created: created,
        source_registry_configs_updated: updated,
      },
      null,
      2
    )
  );
}

await main();
