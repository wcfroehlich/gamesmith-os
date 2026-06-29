import { jsonError, requireWorkspaceActor } from "@/lib/canonical/identity";
import { exportStoryBankTSV } from "@/lib/canonical/stories";

export async function GET(request: Request) {
  try {
    await requireWorkspaceActor(request);
    const tsv = await exportStoryBankTSV();

    return new Response(tsv, {
      headers: {
        "Content-Type": "text/tab-separated-values; charset=utf-8",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
