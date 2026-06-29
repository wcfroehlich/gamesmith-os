import { jsonError, requireWorkspaceActor } from "@/lib/canonical/identity";
import { listStoryBank } from "@/lib/canonical/stories";
import watchList from "@/data/watch-list.json";

export async function GET(request: Request) {
  try {
    await requireWorkspaceActor(request);

    return Response.json({
      bank: await listStoryBank(),
      watchList,
    });
  } catch (error) {
    return jsonError(error);
  }
}
