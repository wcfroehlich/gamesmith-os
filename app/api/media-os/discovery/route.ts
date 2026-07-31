import { runJimmy } from "@/agents/jimmy";
import { bearerToken, parseDiscoveryRequest, publicError } from "@/lib/mediaOsSecurity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 300;
const RATE_LIMIT = 5;

function response(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function audit(
  workspaceId: string,
  actorId: string,
  productionId: string,
  action: string,
  targetId: string | null,
  detail: Record<string, unknown> = {},
) {
  await supabaseAdmin.from("media_os_audit_log").insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    production_id: productionId,
    action,
    target_type: "discovery_job",
    target_id: targetId,
    detail,
  });
}

export async function POST(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return response(401, { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in is required." } });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return response(401, { ok: false, error: { code: "INVALID_SESSION", message: "The session is invalid or expired." } });
  }

  let input;
  try {
    input = parseDiscoveryRequest(await request.json());
  } catch (error) {
    return response(400, { ok: false, error: publicError(error) });
  }

  const userId = authData.user.id;
  const { data: member } = await supabaseAdmin
    .from("media_os_workspace_members")
    .select("role")
    .eq("workspace_id", input.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member || !["owner", "administrator", "editor"].includes(member.role)) {
    return response(403, { ok: false, error: { code: "FORBIDDEN", message: "Discovery is not authorized for this workspace." } });
  }

  const { data: production } = await supabaseAdmin
    .from("media_os_productions")
    .select("id,cost_cap_usd,current_cost_usd,state")
    .eq("id", input.production_id)
    .eq("workspace_id", input.workspace_id)
    .maybeSingle();
  if (!production) return response(404, { ok: false, error: { code: "PRODUCTION_NOT_FOUND", message: "The production was not found." } });
  if (Number(production.current_cost_usd) + input.cost_cap_usd > Number(production.cost_cap_usd)) {
    await audit(input.workspace_id, userId, input.production_id, "discovery.blocked_cost_cap", null, { requested_cap_usd: input.cost_cap_usd });
    return response(409, { ok: false, error: { code: "COST_CAP_EXCEEDED", message: "The production cost cap would be exceeded." } });
  }

  const { data: existing } = await supabaseAdmin
    .from("media_os_discovery_jobs")
    .select("id,status,result,error_code,error_detail,attempts")
    .eq("workspace_id", input.workspace_id)
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();
  if (existing) return response(200, { ok: true, idempotent_replay: true, job: existing });

  const minute = new Date();
  minute.setSeconds(0, 0);
  const { data: rate } = await supabaseAdmin
    .from("media_os_rate_limits")
    .select("request_count")
    .eq("workspace_id", input.workspace_id)
    .eq("user_id", userId)
    .eq("window_start", minute.toISOString())
    .maybeSingle();
  if (rate && Number(rate.request_count) >= RATE_LIMIT) {
    return response(429, { ok: false, error: { code: "RATE_LIMITED", message: "Too many discovery requests. Try again shortly." } });
  }
  await supabaseAdmin.from("media_os_rate_limits").upsert({
    workspace_id: input.workspace_id,
    user_id: userId,
    window_start: minute.toISOString(),
    request_count: Number(rate?.request_count || 0) + 1,
  });

  const { data: job, error: createError } = await supabaseAdmin
    .from("media_os_discovery_jobs")
    .insert({ ...input, requested_by: userId, status: "working", attempts: 1, started_at: new Date().toISOString() })
    .select("id,status")
    .single();
  if (createError || !job) {
    const { data: raced } = await supabaseAdmin.from("media_os_discovery_jobs").select("id,status,result,error_code,error_detail,attempts").eq("workspace_id", input.workspace_id).eq("idempotency_key", input.idempotency_key).maybeSingle();
    if (raced) return response(200, { ok: true, idempotent_replay: true, job: raced });
    return response(409, { ok: false, error: { code: "JOB_CONFLICT", message: "The discovery job could not be created safely." } });
  }

  await audit(input.workspace_id, userId, input.production_id, "discovery.started", job.id, { branch: input.branch, dry_run: input.dry_run, requested_cap_usd: input.cost_cap_usd });
  try {
    const stories = input.dry_run ? [{ fixture_id: "dry-run-no-provider-call", status: "validated" }] : await runJimmy();
    const result = { branch: input.branch, stories, provider_called: !input.dry_run };
    await supabaseAdmin.from("media_os_discovery_jobs").update({ status: "complete", result, finished_at: new Date().toISOString() }).eq("id", job.id);
    await audit(input.workspace_id, userId, input.production_id, "discovery.completed", job.id, { story_count: stories.length, provider_called: !input.dry_run });
    return response(200, { ok: true, idempotent_replay: false, job: { id: job.id, status: "complete", result } });
  } catch (error) {
    const safe = publicError(error);
    await supabaseAdmin.from("media_os_discovery_jobs").update({ status: "failed", error_code: safe.code, error_detail: safe.message, finished_at: new Date().toISOString() }).eq("id", job.id);
    await audit(input.workspace_id, userId, input.production_id, "discovery.failed", job.id, { error_code: safe.code });
    return response(502, { ok: false, job_id: job.id, error: safe });
  }
}
