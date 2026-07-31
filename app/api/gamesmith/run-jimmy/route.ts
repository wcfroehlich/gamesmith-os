import { runJimmy } from "@/agents/jimmy";

export async function GET(request: Request) {
  const secret = process.env.JIMMY_CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const stories = await runJimmy();

    return Response.json({
      agent: "Jimmy",
      runAt: new Date().toISOString(),
      stories,
    });
  } catch (error) {
    console.error("Run Jimmy API failed:", error);

    return Response.json(
      {
        agent: "Jimmy",
        runAt: new Date().toISOString(),
        stories: [
          {
            title: "Jimmy API crashed",
            source: "System",
            storyArc: "Other",
            contentScore: 0,
            timeScore: 0,
            freshness: "Expired",
            recommended: "Archive",
            whyGamersCare:
              error instanceof Error ? error.message : "Unknown API error.",
          },
        ],
      },
      { status: 200 }
    );
  }
}
