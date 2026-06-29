import { runJimmy } from "@/agents/jimmy";
import { jsonError, requireWorkspaceActor } from "@/lib/canonical/identity";
import { recordJimmyIntake } from "@/lib/canonical/stories";

export async function GET() {
  return Response.json(
    { ok: false, error: "Use POST for authenticated Jimmy intake." },
    { status: 405 }
  );
}

export async function POST(request: Request) {
  try {
    const actor = await requireWorkspaceActor(request);
    const stories = await runJimmy();
    const intake = await recordJimmyIntake(actor, stories, "manual");

    return Response.json({
      agent: "Jimmy",
      runAt: new Date().toISOString(),
      intake,
      stories,
    });
  } catch (error) {
    console.error("Run Jimmy API failed:", error);
    return jsonError(error);
  }
}
