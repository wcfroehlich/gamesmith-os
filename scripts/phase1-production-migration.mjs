import { createClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "auzjilvjqjblgysargum";
const BASELINE_COUNTS = {
  jimmy_memory: 135,
  story_bank: 1,
  story_archive: 0,
  daily_runs: 0,
  watch_list: 0,
};

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function projectRefFromUrl(url) {
  const host = new URL(url).host;
  return host.split(".")[0];
}

function assertProductionTarget(url) {
  const envRef = process.env.SUPABASE_PROJECT_REF;
  const urlRef = projectRefFromUrl(url);
  const ref = envRef || urlRef;

  console.log(`Target Supabase project ref: ${ref}`);

  if (ref !== PRODUCTION_PROJECT_REF || urlRef !== PRODUCTION_PROJECT_REF) {
    throw new Error(
      `Refusing production migration: expected ${PRODUCTION_PROJECT_REF}, got env=${envRef || "(unset)"} url=${urlRef}.`
    );
  }
}

function assertCountsMatch(label, actual, expected) {
  const mismatches = Object.entries(expected).filter(
    ([table, count]) => actual[table] !== count
  );

  if (mismatches.length > 0) {
    throw new Error(
      `${label} counts do not match baseline: ${JSON.stringify(mismatches)}`
    );
  }
}

async function tableCount(client, table) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

async function readLiveCounts(client) {
  const entries = await Promise.all(
    Object.keys(BASELINE_COUNTS).map(async (table) => [
      table,
      await tableCount(client, table),
    ])
  );
  return Object.fromEntries(entries);
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  assertProductionTarget(supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const liveCounts = await readLiveCounts(supabase);
  console.log(`Live baseline counts: ${JSON.stringify(liveCounts)}`);
  assertCountsMatch("Live", liveCounts, BASELINE_COUNTS);

  const { data: dryRun, error: dryRunError } = await supabase.rpc(
    "import_live_jimmy_legacy",
    { p_dry_run: true }
  );
  if (dryRunError) throw dryRunError;

  console.log(`DB-native dry run: ${JSON.stringify(dryRun)}`);
  assertCountsMatch("Dry-run", dryRun.legacy_counts || {}, BASELINE_COUNTS);

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to import live data.");
    return;
  }

  const { data: applied, error: applyError } = await supabase.rpc(
    "import_live_jimmy_legacy",
    { p_dry_run: false }
  );
  if (applyError) throw applyError;

  const migrationBatchId = applied?.migration_batch_id;
  if (!migrationBatchId) {
    throw new Error(`No migration_batch_id returned: ${JSON.stringify(applied)}`);
  }

  const { data: validation, error: validationError } = await supabase.rpc(
    "validate_phase1_migration",
    { p_migration_batch_id: migrationBatchId }
  );
  if (validationError) throw validationError;

  console.log(
    JSON.stringify(
      {
        ok: true,
        migration_batch_id: migrationBatchId,
        applied,
        validation,
      },
      null,
      2
    )
  );

  const blockingValidationKeys = [
    "malformed_or_unresolved_payloads",
    "imported_stories_without_legacy_payload",
    "legacy_archive_unknown_rationale",
    "story_bank_no_actionable_source_links",
    "self_relations",
    "merged_story_cycles",
  ];
  const blocking = blockingValidationKeys.filter((key) => Number(validation?.[key] || 0) > 0);
  if (blocking.length > 0) {
    throw new Error(`Blocking validation failures: ${blocking.join(", ")}`);
  }
}

await main();
