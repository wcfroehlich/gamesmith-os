import { runJimmy } from "@/agents/jimmy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const secret = process.env.JIMMY_CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  if (
    secret &&
    authHeader !== `Bearer ${secret}` &&
    querySecret !== secret
  ) {
    return Response.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const stories = await runJimmy();

    await supabaseAdmin.from("daily_runs").insert({
      status: "success",
      package_count: stories.length,
      stories,
    });

    return Response.json({
      ok: true,
      package_count: stories.length,
      stories,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Jimmy daily run error";

    await supabaseAdmin.from("daily_runs").insert({
      status: "failed",
      error: message,
    });

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}