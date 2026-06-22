import { runJimmy } from "@/agents/jimmy";

export async function GET() {
  const stories = await runJimmy();

  return Response.json({
    agent: "Jimmy",
    runAt: new Date().toISOString(),
    stories,
  });
}