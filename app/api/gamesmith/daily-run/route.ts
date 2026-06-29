import { runJimmy } from "@/agents/jimmy";
import { getSystemActorContext } from "@/lib/canonical/identity";
import { recordJimmyIntake } from "@/lib/canonical/stories";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const secret = process.env.JIMMY_CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const actor = await getSystemActorContext();
    const stories = await runJimmy();
    const intake = await recordJimmyIntake(actor, stories, "scheduled");

    return Response.json({
      ok: true,
      package_count: stories.length,
      intake,
      stories,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Jimmy daily run error";
    try {
      const actor = await getSystemActorContext();
      const { data: object } = await supabaseAdmin
        .from("newsroom_objects")
        .insert({
          workspace_id: actor.workspaceId,
          object_type: "ingestion_run",
          created_by_actor_id: actor.actorId,
          system_generated: true,
        })
        .select("id")
        .single();

      if (object) {
        await supabaseAdmin.from("ingestion_runs").insert({
          newsroom_object_id: object.id,
          workspace_id: actor.workspaceId,
          run_type: "scheduled",
          completed_at: new Date().toISOString(),
          status: "failed",
          error_summary: message,
          triggered_by_actor_id: actor.actorId,
        });
      }
    } catch (recordError) {
      console.error("Failed to record canonical ingestion failure", recordError);
    }

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
